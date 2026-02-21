import { eq, and, sql, desc, ilike, gte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { locks, lockLinks, products, features } from '../db/schema.js';
import { generateShortId } from '../lib/id.js';
import { detectConflicts } from './conflict-service.js';
import { notifySlack } from './notify-service.js';
import { updateKnowledgeIncremental } from './knowledge-service.js';
import { inferDecisionType } from '../lib/llm.js';
import type {
  CreateLockRequest,
  RevertLockRequest,
  AddLinkRequest,
  ListLocksQuery,
  SearchLocksRequest,
  DecisionType,
} from '../types.js';

// Auto-create product/feature by slug (upsert)
async function upsertProduct(workspaceId: string, slug: string) {
  let product = await db.query.products.findFirst({
    where: and(eq(products.workspaceId, workspaceId), eq(products.slug, slug)),
  });
  if (!product) {
    const name = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const [created] = await db
      .insert(products)
      .values({ workspaceId, slug, name })
      .returning();
    product = created;
  }
  return product;
}

async function upsertFeature(productId: string, slug: string) {
  let feature = await db.query.features.findFirst({
    where: and(eq(features.productId, productId), eq(features.slug, slug)),
  });
  if (!feature) {
    const name = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const [created] = await db
      .insert(features)
      .values({ productId, slug, name })
      .returning();
    feature = created;
  }
  return feature;
}

// Generate short ID with collision retry
async function generateUniqueShortId(maxRetries = 3): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const shortId = generateShortId();
    const existing = await db.query.locks.findFirst({
      where: eq(locks.shortId, shortId),
    });
    if (!existing) return shortId;
  }
  throw new Error('Failed to generate unique short ID after retries');
}

export async function commitLock(workspaceId: string, req: CreateLockRequest) {
  // Upsert product and feature
  const product = await upsertProduct(workspaceId, req.product);
  const feature = await upsertFeature(product.id, req.feature);
  const shortId = await generateUniqueShortId();

  // Insert the lock
  const [lock] = await db
    .insert(locks)
    .values({
      shortId,
      workspaceId,
      productId: product.id,
      featureId: feature.id,
      message: req.message,
      authorType: req.author.type,
      authorId: req.author.id,
      authorName: req.author.name,
      authorSource: req.author.source,
      scope: req.scope ?? 'minor',
      status: 'active',
      tags: req.tags ?? [],
      sourceType: req.source.type,
      sourceRef: req.source.ref ?? null,
      sourceContext: req.source.context ?? null,
      participants: req.source.participants ?? [],
    })
    .returning();

  // Insert links
  if (req.links?.length) {
    await db.insert(lockLinks).values(
      req.links.map((link) => ({
        lockId: lock.id,
        linkType: link.type,
        linkRef: link.ref,
      }))
    );
  }

  // Run conflict detection + type inference in parallel
  const [conflictResult, typeResult] = await Promise.all([
    detectConflicts(
      lock.id,
      product.id,
      req.message,
      req.scope ?? 'minor',
      req.source.context ?? null,
      feature.name
    ),
    req.decision_type
      ? Promise.resolve({ decision_type: req.decision_type, confidence: 1 })
      : inferDecisionType(req.message, req.source.context, req.product, req.feature),
  ]);

  const { conflicts, supersession } = conflictResult;

  // Update lock with inferred decision type
  if (typeResult.decision_type) {
    await db
      .update(locks)
      .set({ decisionType: typeResult.decision_type })
      .where(eq(locks.id, lock.id));
  }

  // Handle supersession
  if (supersession.detected && supersession.supersedes) {
    const superseded = await db.query.locks.findFirst({
      where: eq(locks.shortId, supersession.supersedes.short_id),
    });
    if (superseded) {
      await db
        .update(locks)
        .set({ supersededById: lock.id, status: 'superseded' })
        .where(eq(locks.id, superseded.id));
      await db
        .update(locks)
        .set({ supersedesId: superseded.id })
        .where(eq(locks.id, lock.id));
    }
  }

  // Notify Slack if lock didn't come from Slack
  if (req.source.type !== 'slack') {
    await notifySlack({
      shortId: lock.shortId,
      message: lock.message,
      authorName: lock.authorName,
      authorSource: lock.authorSource,
      featureId: lock.featureId,
    }).catch(() => {}); // Non-blocking
  }

  // Update knowledge (fire-and-forget)
  updateKnowledgeIncremental(workspaceId, product.id, feature.id, {
    message: req.message,
    scope: req.scope ?? 'minor',
    decisionType: typeResult.decision_type || null,
  }).catch(() => {});

  // Fetch links for response
  const links = await db.query.lockLinks.findMany({
    where: eq(lockLinks.lockId, lock.id),
  });

  return {
    lock: {
      id: lock.id,
      short_id: lock.shortId,
      message: lock.message,
      product: { slug: product.slug, name: product.name },
      feature: { slug: feature.slug, name: feature.name },
      author: {
        type: lock.authorType,
        id: lock.authorId,
        name: lock.authorName,
        source: lock.authorSource,
      },
      scope: lock.scope,
      status: lock.status,
      tags: lock.tags,
      decision_type: typeResult.decision_type || lock.decisionType || null,
      source: {
        type: lock.sourceType,
        ref: lock.sourceRef,
        context: lock.sourceContext,
        participants: lock.participants,
      },
      links: links.map((l) => ({ type: l.linkType, ref: l.linkRef })),
      created_at: lock.createdAt,
    },
    conflicts,
    supersession,
  };
}

export async function listLocks(workspaceId: string, query: ListLocksQuery) {
  const conditions: any[] = [eq(locks.workspaceId, workspaceId)];

  if (query.product) {
    const product = await db.query.products.findFirst({
      where: and(eq(products.workspaceId, workspaceId), eq(products.slug, query.product)),
    });
    if (product) conditions.push(eq(locks.productId, product.id));
    else return { locks: [], total: 0 };
  }

  if (query.feature) {
    // Need to find feature across all products in workspace
    const productRows = await db.query.products.findMany({
      where: eq(products.workspaceId, workspaceId),
    });
    const productIds = productRows.map((p) => p.id);
    let featureRow = null;
    for (const pid of productIds) {
      featureRow = await db.query.features.findFirst({
        where: and(eq(features.productId, pid), eq(features.slug, query.feature)),
      });
      if (featureRow) break;
    }
    if (featureRow) conditions.push(eq(locks.featureId, featureRow.id));
    else return { locks: [], total: 0 };
  }

  if (query.scope) conditions.push(eq(locks.scope, query.scope));
  if (query.status) conditions.push(eq(locks.status, query.status));
  if (query.author) conditions.push(eq(locks.authorName, query.author));
  if (query.decision_type) conditions.push(eq(locks.decisionType, query.decision_type));

  const where = and(...conditions);
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;

  const rows = await db
    .select()
    .from(locks)
    .where(where ?? undefined)
    .orderBy(desc(locks.createdAt))
    .limit(limit)
    .offset(offset);

  // Enrich with product/feature info
  const enriched = await Promise.all(
    rows.map(async (lock) => {
      const product = await db.query.products.findFirst({
        where: eq(products.id, lock.productId),
      });
      const feature = await db.query.features.findFirst({
        where: eq(features.id, lock.featureId),
      });
      return {
        short_id: lock.shortId,
        message: lock.message,
        product: product ? { slug: product.slug, name: product.name } : null,
        feature: feature ? { slug: feature.slug, name: feature.name } : null,
        author: {
          type: lock.authorType,
          name: lock.authorName,
          source: lock.authorSource,
        },
        scope: lock.scope,
        status: lock.status,
        tags: lock.tags,
        decision_type: lock.decisionType,
        created_at: lock.createdAt,
      };
    })
  );

  return { locks: enriched, total: enriched.length };
}

export async function getLock(shortId: string) {
  const lock = await db.query.locks.findFirst({
    where: eq(locks.shortId, shortId),
  });
  if (!lock) return null;

  const product = await db.query.products.findFirst({
    where: eq(products.id, lock.productId),
  });
  const feature = await db.query.features.findFirst({
    where: eq(features.id, lock.featureId),
  });
  const links = await db.query.lockLinks.findMany({
    where: eq(lockLinks.lockId, lock.id),
  });

  return {
    id: lock.id,
    short_id: lock.shortId,
    message: lock.message,
    product: product ? { slug: product.slug, name: product.name } : null,
    feature: feature ? { slug: feature.slug, name: feature.name } : null,
    author: {
      type: lock.authorType,
      id: lock.authorId,
      name: lock.authorName,
      source: lock.authorSource,
    },
    scope: lock.scope,
    status: lock.status,
    tags: lock.tags,
    decision_type: lock.decisionType,
    source: {
      type: lock.sourceType,
      ref: lock.sourceRef,
      context: lock.sourceContext,
      participants: lock.participants,
    },
    lineage: {
      supersedes_id: lock.supersedesId,
      superseded_by_id: lock.supersededById,
      reverted_by_id: lock.revertedById,
    },
    links: links.map((l) => ({ type: l.linkType, ref: l.linkRef })),
    created_at: lock.createdAt,
  };
}

export async function revertLock(
  workspaceId: string,
  shortId: string,
  req: RevertLockRequest
) {
  const original = await db.query.locks.findFirst({
    where: eq(locks.shortId, shortId),
  });
  if (!original) return null;
  if (original.status !== 'active') {
    throw new Error(`Cannot revert lock with status "${original.status}"`);
  }

  const revertShortId = await generateUniqueShortId();

  // Create the revert lock
  const [revertLock] = await db
    .insert(locks)
    .values({
      shortId: revertShortId,
      workspaceId,
      productId: original.productId,
      featureId: original.featureId,
      message: req.message,
      authorType: req.author.type,
      authorId: req.author.id,
      authorName: req.author.name,
      authorSource: req.author.source,
      scope: original.scope,
      status: 'active',
      tags: ['revert'],
      sourceType: req.author.source === 'slack' ? 'slack' : req.author.source === 'cli' ? 'cli' : 'api',
      sourceRef: null,
      sourceContext: `Reverts ${shortId}: ${original.message}`,
      participants: [],
    })
    .returning();

  // Update original lock
  await db
    .update(locks)
    .set({ status: 'reverted', revertedById: revertLock.id })
    .where(eq(locks.id, original.id));

  // Update knowledge (fire-and-forget)
  updateKnowledgeIncremental(workspaceId, original.productId, original.featureId, {
    message: req.message,
    scope: original.scope,
    decisionType: null,
  }).catch(() => {});

  const product = await db.query.products.findFirst({
    where: eq(products.id, original.productId),
  });
  const feature = await db.query.features.findFirst({
    where: eq(features.id, original.featureId),
  });

  return {
    reverted: {
      short_id: original.shortId,
      message: original.message,
      status: 'reverted',
    },
    revert_lock: {
      short_id: revertLock.shortId,
      message: revertLock.message,
      product: product ? { slug: product.slug, name: product.name } : null,
      feature: feature ? { slug: feature.slug, name: feature.name } : null,
      created_at: revertLock.createdAt,
    },
  };
}

export async function addLink(shortId: string, req: AddLinkRequest) {
  const lock = await db.query.locks.findFirst({
    where: eq(locks.shortId, shortId),
  });
  if (!lock) return null;

  const [link] = await db
    .insert(lockLinks)
    .values({
      lockId: lock.id,
      linkType: req.link_type,
      linkRef: req.link_ref,
    })
    .returning();

  return { type: link.linkType, ref: link.linkRef };
}

export async function updateLockMetadata(
  shortId: string,
  updates: { scope?: 'minor' | 'major' | 'architectural'; tags?: string[]; decision_type?: DecisionType },
) {
  const lock = await db.query.locks.findFirst({
    where: eq(locks.shortId, shortId),
  });
  if (!lock) return null;
  if (lock.status !== 'active') {
    throw new Error(`Cannot update lock with status "${lock.status}"`);
  }

  const setValues: Record<string, any> = {};
  if (updates.scope) setValues.scope = updates.scope;
  if (updates.tags) setValues.tags = updates.tags;
  if (updates.decision_type) setValues.decisionType = updates.decision_type;

  if (Object.keys(setValues).length === 0) {
    throw new Error('No valid fields to update');
  }

  const [updated] = await db
    .update(locks)
    .set(setValues)
    .where(eq(locks.id, lock.id))
    .returning();

  const product = await db.query.products.findFirst({
    where: eq(products.id, updated.productId),
  });
  const feature = await db.query.features.findFirst({
    where: eq(features.id, updated.featureId),
  });

  return {
    short_id: updated.shortId,
    message: updated.message,
    scope: updated.scope,
    tags: updated.tags,
    decision_type: updated.decisionType,
    status: updated.status,
    product: product ? { slug: product.slug, name: product.name } : null,
    feature: feature ? { slug: feature.slug, name: feature.name } : null,
  };
}

export async function searchLocks(workspaceId: string, req: SearchLocksRequest) {
  // Text-based fallback search (semantic search works when embeddings are available)
  const conditions: any[] = [
    eq(locks.workspaceId, workspaceId),
    eq(locks.status, 'active'),
  ];

  if (req.product) {
    const product = await db.query.products.findFirst({
      where: and(eq(products.workspaceId, workspaceId), eq(products.slug, req.product)),
    });
    if (product) conditions.push(eq(locks.productId, product.id));
  }

  if (req.feature) {
    const productRows = await db.query.products.findMany({
      where: eq(products.workspaceId, workspaceId),
    });
    for (const p of productRows) {
      const f = await db.query.features.findFirst({
        where: and(eq(features.productId, p.id), eq(features.slug, req.feature)),
      });
      if (f) {
        conditions.push(eq(locks.featureId, f.id));
        break;
      }
    }
  }

  const where = and(...conditions);

  // Try semantic search first if we have an embedding
  const { generateEmbedding } = await import('../lib/embeddings.js');
  const queryEmbedding = await generateEmbedding(req.query);

  if (queryEmbedding) {
    const vectorStr = `[${queryEmbedding.join(',')}]`;
    const results = await db.execute(
      sql`SELECT l.*, 1 - (l.embedding <=> ${vectorStr}::vector) as similarity,
                 p.slug as product_slug, p.name as product_name,
                 f.slug as feature_slug, f.name as feature_name
          FROM locks l
          JOIN products p ON p.id = l.product_id
          JOIN features f ON f.id = l.feature_id
          WHERE l.workspace_id = ${workspaceId}::uuid
            AND l.status = 'active'
            AND l.embedding IS NOT NULL
          ORDER BY l.embedding <=> ${vectorStr}::vector
          LIMIT 10`
    );

    return {
      locks: (results.rows as any[]).map((r) => ({
        short_id: r.short_id,
        message: r.message,
        product: { slug: r.product_slug, name: r.product_name },
        feature: { slug: r.feature_slug, name: r.feature_name },
        scope: r.scope,
        status: r.status,
        decision_type: r.decision_type,
        similarity: r.similarity,
        created_at: r.created_at,
      })),
    };
  }

  // Fallback: text search with ILIKE
  const rows = await db
    .select()
    .from(locks)
    .where(and(...conditions, ilike(locks.message, `%${req.query}%`)))
    .orderBy(desc(locks.createdAt))
    .limit(10);

  const enriched = await Promise.all(
    rows.map(async (lock) => {
      const product = await db.query.products.findFirst({
        where: eq(products.id, lock.productId),
      });
      const feature = await db.query.features.findFirst({
        where: eq(features.id, lock.featureId),
      });
      return {
        short_id: lock.shortId,
        message: lock.message,
        product: product ? { slug: product.slug, name: product.name } : null,
        feature: feature ? { slug: feature.slug, name: feature.name } : null,
        scope: lock.scope,
        status: lock.status,
        decision_type: lock.decisionType,
        created_at: lock.createdAt,
      };
    })
  );

  return { locks: enriched };
}

export interface RecapQuery {
  product?: string;
  since?: string;
  limit?: number;
}

export async function getRecap(workspaceId: string, query: RecapQuery) {
  const conditions: any[] = [eq(locks.workspaceId, workspaceId)];

  // Date filter
  const sinceDate = query.since
    ? new Date(query.since)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  conditions.push(gte(locks.createdAt, sinceDate));

  if (query.product) {
    const product = await db.query.products.findFirst({
      where: and(eq(products.workspaceId, workspaceId), eq(products.slug, query.product)),
    });
    if (product) conditions.push(eq(locks.productId, product.id));
    else return {
      period: { from: sinceDate.toISOString(), to: new Date().toISOString() },
      summary: { total_decisions: 0, by_scope: {}, by_type: {}, by_product: [], reverts: 0, supersessions: 0 },
      decisions: [],
      top_contributors: [],
    };
  }

  const where = and(...conditions);
  const limit = query.limit ?? 100;

  const rows = await db
    .select()
    .from(locks)
    .where(where ?? undefined)
    .orderBy(desc(locks.createdAt))
    .limit(limit);

  // Enrich and aggregate
  const byScope: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byProductMap = new Map<string, { slug: string; name: string; count: number }>();
  const contributorMap = new Map<string, number>();
  let reverts = 0;
  let supersessions = 0;

  const enriched = await Promise.all(
    rows.map(async (lock) => {
      const product = await db.query.products.findFirst({
        where: eq(products.id, lock.productId),
      });
      const feature = await db.query.features.findFirst({
        where: eq(features.id, lock.featureId),
      });

      // Aggregate
      byScope[lock.scope] = (byScope[lock.scope] || 0) + 1;
      if (lock.decisionType) {
        byType[lock.decisionType] = (byType[lock.decisionType] || 0) + 1;
      }
      if (product) {
        const existing = byProductMap.get(product.slug);
        if (existing) existing.count++;
        else byProductMap.set(product.slug, { slug: product.slug, name: product.name, count: 1 });
      }
      contributorMap.set(lock.authorName, (contributorMap.get(lock.authorName) || 0) + 1);
      if (lock.status === 'reverted') reverts++;
      if (lock.supersedesId) supersessions++;

      return {
        short_id: lock.shortId,
        message: lock.message,
        product: product ? { slug: product.slug, name: product.name } : null,
        feature: feature ? { slug: feature.slug, name: feature.name } : null,
        author: {
          type: lock.authorType,
          name: lock.authorName,
          source: lock.authorSource,
        },
        scope: lock.scope,
        status: lock.status,
        tags: lock.tags,
        decision_type: lock.decisionType,
        created_at: lock.createdAt,
      };
    })
  );

  const topContributors = [...contributorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    period: { from: sinceDate.toISOString(), to: new Date().toISOString() },
    summary: {
      total_decisions: rows.length,
      by_scope: byScope,
      by_type: byType,
      by_product: [...byProductMap.values()],
      reverts,
      supersessions,
    },
    decisions: enriched,
    top_contributors: topContributors,
  };
}
