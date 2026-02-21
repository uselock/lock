import { eq, and, desc, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { knowledge, locks, products, features } from '../db/schema.js';
import { synthesizeKnowledgeFacet, synthesizeKnowledgeFacetFull, hasLLM } from '../lib/llm.js';
import { KNOWLEDGE_FACETS } from '../types.js';
import type { KnowledgeFacet, KnowledgeEntry, KnowledgeResponse } from '../types.js';

export async function getKnowledge(
  workspaceId: string,
  productSlug: string,
  featureSlug?: string,
): Promise<KnowledgeResponse | null> {
  // Resolve product
  const product = await db.query.products.findFirst({
    where: and(eq(products.workspaceId, workspaceId), eq(products.slug, productSlug)),
  });
  if (!product) return null;

  // Resolve feature if specified
  let feature = null;
  if (featureSlug) {
    feature = await db.query.features.findFirst({
      where: and(eq(features.productId, product.id), eq(features.slug, featureSlug)),
    });
    if (!feature) return null;
  }

  // Query existing knowledge
  const conditions = [eq(knowledge.productId, product.id)];
  if (feature) {
    conditions.push(eq(knowledge.featureId, feature.id));
  } else {
    conditions.push(isNull(knowledge.featureId));
  }

  const rows = await db.query.knowledge.findMany({
    where: and(...conditions),
  });

  // Check if knowledge is stale (lock count drifted >50%)
  const lockCount = await countLocks(workspaceId, product.id, feature?.id);
  const isStale = rows.length > 0 && rows.some(r => {
    const drift = Math.abs(lockCount - r.lockCountAtGeneration);
    return r.lockCountAtGeneration > 0
      ? drift / r.lockCountAtGeneration > 0.5
      : lockCount > 0;
  });

  // If missing or stale, regenerate
  if (rows.length === 0 || isStale) {
    if (!hasLLM()) {
      return {
        product: { slug: product.slug, name: product.name },
        feature: feature ? { slug: feature.slug, name: feature.name } : undefined,
        facets: [],
      };
    }

    await regenerateKnowledgeInternal(workspaceId, product.id, feature?.id, product.name, feature?.name);

    // Re-fetch after generation
    const refreshed = await db.query.knowledge.findMany({
      where: and(...conditions),
    });

    return {
      product: { slug: product.slug, name: product.name },
      feature: feature ? { slug: feature.slug, name: feature.name } : undefined,
      facets: refreshed.map(toKnowledgeEntry),
    };
  }

  return {
    product: { slug: product.slug, name: product.name },
    feature: feature ? { slug: feature.slug, name: feature.name } : undefined,
    facets: rows.map(toKnowledgeEntry),
  };
}

export async function updateKnowledgeIncremental(
  workspaceId: string,
  productId: string,
  featureId: string,
  newDecision: { message: string; scope: string; decisionType?: string | null },
): Promise<void> {
  if (!hasLLM()) return;

  // Resolve names
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
  });
  const feature = await db.query.features.findFirst({
    where: eq(features.id, featureId),
  });
  if (!product || !feature) return;

  // Fetch 10 most recent active decisions for this feature
  const recentFeatureDecisions = await db
    .select()
    .from(locks)
    .where(and(eq(locks.featureId, featureId), eq(locks.status, 'active')))
    .orderBy(desc(locks.createdAt))
    .limit(10);

  const recentMapped = recentFeatureDecisions.map(d => ({
    message: d.message,
    scope: d.scope,
    decisionType: d.decisionType,
  }));

  const featureLockCount = await countLocks(workspaceId, productId, featureId);

  // Update feature-level knowledge
  for (const facet of KNOWLEDGE_FACETS) {
    await updateSingleFacet(
      workspaceId,
      productId,
      featureId,
      facet,
      newDecision,
      recentMapped,
      product.name,
      feature.name,
      featureLockCount,
    );
  }

  // Update product-level knowledge (featureId = null)
  const recentProductDecisions = await db
    .select({ message: locks.message, scope: locks.scope, decisionType: locks.decisionType })
    .from(locks)
    .where(and(eq(locks.productId, productId), eq(locks.status, 'active')))
    .orderBy(desc(locks.createdAt))
    .limit(10);

  const productLockCount = await countLocks(workspaceId, productId, undefined);

  for (const facet of KNOWLEDGE_FACETS) {
    await updateSingleFacet(
      workspaceId,
      productId,
      null,
      facet,
      newDecision,
      recentProductDecisions,
      product.name,
      undefined,
      productLockCount,
    );
  }
}

export async function regenerateKnowledge(
  workspaceId: string,
  productSlug: string,
  featureSlug?: string,
): Promise<KnowledgeResponse | null> {
  if (!hasLLM()) return null;

  const product = await db.query.products.findFirst({
    where: and(eq(products.workspaceId, workspaceId), eq(products.slug, productSlug)),
  });
  if (!product) return null;

  let feature = null;
  if (featureSlug) {
    feature = await db.query.features.findFirst({
      where: and(eq(features.productId, product.id), eq(features.slug, featureSlug)),
    });
    if (!feature) return null;
  }

  await regenerateKnowledgeInternal(workspaceId, product.id, feature?.id, product.name, feature?.name);

  // Fetch and return
  const conditions = [eq(knowledge.productId, product.id)];
  if (feature) {
    conditions.push(eq(knowledge.featureId, feature.id));
  } else {
    conditions.push(isNull(knowledge.featureId));
  }

  const rows = await db.query.knowledge.findMany({
    where: and(...conditions),
  });

  return {
    product: { slug: product.slug, name: product.name },
    feature: feature ? { slug: feature.slug, name: feature.name } : undefined,
    facets: rows.map(toKnowledgeEntry),
  };
}

// --- Internal helpers ---

async function updateSingleFacet(
  workspaceId: string,
  productId: string,
  featureId: string | null,
  facet: KnowledgeFacet,
  newDecision: { message: string; scope: string; decisionType?: string | null },
  recentDecisions: { message: string; scope: string; decisionType?: string | null }[],
  productName: string,
  featureName: string | undefined,
  lockCount: number,
): Promise<void> {
  // Fetch existing facet
  const conditions = [
    eq(knowledge.productId, productId),
    eq(knowledge.facet, facet),
  ];
  if (featureId) {
    conditions.push(eq(knowledge.featureId, featureId));
  } else {
    conditions.push(isNull(knowledge.featureId));
  }

  const existing = await db.query.knowledge.findFirst({
    where: and(...conditions),
  });

  const content = await synthesizeKnowledgeFacet(
    facet,
    existing?.content ?? null,
    newDecision,
    recentDecisions,
    productName,
    featureName,
  );

  if (!content) return;

  if (existing) {
    await db
      .update(knowledge)
      .set({
        content,
        version: existing.version + 1,
        lockCountAtGeneration: lockCount,
        updatedAt: new Date(),
      })
      .where(eq(knowledge.id, existing.id));
  } else {
    await db.insert(knowledge).values({
      workspaceId,
      productId,
      featureId,
      facet,
      content,
      version: 1,
      lockCountAtGeneration: lockCount,
    });
  }
}

async function regenerateKnowledgeInternal(
  workspaceId: string,
  productId: string,
  featureId: string | undefined,
  productName: string,
  featureName?: string,
): Promise<void> {
  // Fetch all active decisions
  const conditions = [eq(locks.productId, productId), eq(locks.status, 'active')];
  if (featureId) {
    conditions.push(eq(locks.featureId, featureId));
  }

  const allDecisions = await db
    .select()
    .from(locks)
    .where(and(...conditions))
    .orderBy(desc(locks.createdAt));

  if (allDecisions.length === 0) return;

  // Enrich with feature names if product-level
  let decisionsForLLM: { message: string; scope: string; decisionType?: string | null; featureName?: string }[];

  if (!featureId) {
    const featureCache = new Map<string, string>();
    decisionsForLLM = await Promise.all(
      allDecisions.map(async (d) => {
        let fname = featureCache.get(d.featureId);
        if (!fname) {
          const f = await db.query.features.findFirst({ where: eq(features.id, d.featureId) });
          fname = f?.name ?? 'unknown';
          featureCache.set(d.featureId, fname);
        }
        return { message: d.message, scope: d.scope, decisionType: d.decisionType, featureName: fname };
      }),
    );
  } else {
    decisionsForLLM = allDecisions.map(d => ({
      message: d.message, scope: d.scope, decisionType: d.decisionType,
    }));
  }

  const lockCount = allDecisions.length;

  for (const facet of KNOWLEDGE_FACETS) {
    const content = await synthesizeKnowledgeFacetFull(
      facet,
      decisionsForLLM,
      productName,
      featureName,
    );

    if (!content) continue;

    // Upsert
    const upsertConditions = [
      eq(knowledge.productId, productId),
      eq(knowledge.facet, facet),
    ];
    if (featureId) {
      upsertConditions.push(eq(knowledge.featureId, featureId));
    } else {
      upsertConditions.push(isNull(knowledge.featureId));
    }

    const existing = await db.query.knowledge.findFirst({
      where: and(...upsertConditions),
    });

    if (existing) {
      await db
        .update(knowledge)
        .set({
          content,
          version: existing.version + 1,
          lockCountAtGeneration: lockCount,
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(knowledge.id, existing.id));
    } else {
      await db.insert(knowledge).values({
        workspaceId,
        productId,
        featureId: featureId ?? null,
        facet,
        content,
        version: 1,
        lockCountAtGeneration: lockCount,
      });
    }
  }
}

async function countLocks(
  workspaceId: string,
  productId: string,
  featureId?: string,
): Promise<number> {
  const conditions = [
    eq(locks.workspaceId, workspaceId),
    eq(locks.productId, productId),
    eq(locks.status, 'active'),
  ];
  if (featureId) {
    conditions.push(eq(locks.featureId, featureId));
  }

  const rows = await db
    .select({ id: locks.id })
    .from(locks)
    .where(and(...conditions));

  return rows.length;
}

function toKnowledgeEntry(row: typeof knowledge.$inferSelect): KnowledgeEntry {
  return {
    facet: row.facet as KnowledgeFacet,
    content: row.content,
    version: row.version,
    lock_count_at_generation: row.lockCountAtGeneration,
    updated_at: row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}
