import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { locks, features, products } from '../db/schema.js';
import { generateEmbedding } from '../lib/embeddings.js';
import { classifyRelationship, hasLLM } from '../lib/llm.js';
import type { ConflictResult, SupersessionResult } from '../types.js';

/**
 * Simple word-based Jaccard similarity for text fallback.
 */
function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

export async function detectConflicts(
  lockId: string,
  productId: string,
  message: string,
  scope: string,
  sourceContext: string | null,
  featureName: string
): Promise<{ conflicts: ConflictResult[]; supersession: SupersessionResult }> {
  // Step 1: Try vector-based search (requires OpenAI embeddings)
  const embedding = await generateEmbedding(message);

  let similar: any[];

  if (embedding) {
    // Update the lock with its embedding
    await db.execute(
      sql`UPDATE locks SET embedding = ${`[${embedding.join(',')}]`}::vector WHERE id = ${lockId}::uuid`
    );

    // Find similar active locks via pgvector cosine similarity
    const candidates = await db.execute(
      sql`SELECT l.*, 1 - (l.embedding <=> ${`[${embedding.join(',')}]`}::vector) as similarity,
                 f.slug as feature_slug, f.name as feature_name
          FROM locks l
          JOIN features f ON f.id = l.feature_id
          WHERE l.product_id = ${productId}::uuid
            AND l.status = 'active'
            AND l.id != ${lockId}::uuid
            AND l.embedding IS NOT NULL
          ORDER BY l.embedding <=> ${`[${embedding.join(',')}]`}::vector
          LIMIT 5`
    );

    similar = (candidates.rows as any[]).filter((r) => r.similarity > 0.75);
  } else if (hasLLM()) {
    // Fallback: text-based similarity (no embeddings available)
    const candidates = await db.execute(
      sql`SELECT l.*, f.slug as feature_slug, f.name as feature_name
          FROM locks l
          JOIN features f ON f.id = l.feature_id
          WHERE l.product_id = ${productId}::uuid
            AND l.status = 'active'
            AND l.id != ${lockId}::uuid
          ORDER BY l.created_at DESC
          LIMIT 20`
    );

    similar = (candidates.rows as any[])
      .map((r) => ({ ...r, similarity: textSimilarity(message, r.message) }))
      .filter((r) => r.similarity > 0.4)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  } else {
    return { conflicts: [], supersession: { detected: false } };
  }

  if (similar.length === 0) {
    return { conflicts: [], supersession: { detected: false } };
  }

  // Step 2: Classify relationships via LLM (in parallel)
  const classifications = await Promise.all(
    similar.map(async (candidate) => {
      const result = await classifyRelationship(
        {
          message: candidate.message,
          scope: candidate.scope,
          context: candidate.source_context,
          featureName: candidate.feature_name,
        },
        { message, scope, context: sourceContext, featureName }
      );
      return { candidate, result };
    })
  );

  const conflicts: ConflictResult[] = [];
  let supersession: SupersessionResult = { detected: false };

  for (const { candidate, result } of classifications) {
    if (result.relationship === 'potential_conflict' || result.relationship === 'related') {
      conflicts.push({
        lock: {
          short_id: candidate.short_id,
          message: candidate.message,
          scope: candidate.scope,
          feature: { slug: candidate.feature_slug, name: candidate.feature_name },
          created_at: candidate.created_at,
        },
        relationship: result.relationship,
        explanation: result.explanation,
      });
    } else if (result.relationship === 'supersession' && !supersession.detected) {
      supersession = {
        detected: true,
        supersedes: {
          short_id: candidate.short_id,
          message: candidate.message,
        },
        explanation: result.explanation,
      };
    }
  }

  return { conflicts, supersession };
}

/**
 * Pre-check for conflicts BEFORE inserting a lock.
 * Used to warn users and ask for confirmation.
 */
export async function preCheckConflicts(
  workspaceId: string,
  message: string,
  productSlug: string,
  featureSlug: string,
  scope: string,
): Promise<{ conflicts: ConflictResult[]; supersession: SupersessionResult }> {
  if (!hasLLM()) {
    return { conflicts: [], supersession: { detected: false } };
  }

  // Resolve product ID
  const product = await db.query.products.findFirst({
    where: and(eq(products.workspaceId, workspaceId), eq(products.slug, productSlug)),
  });
  if (!product) return { conflicts: [], supersession: { detected: false } };

  // Resolve feature for name
  const feature = await db.query.features.findFirst({
    where: and(eq(features.productId, product.id), eq(features.slug, featureSlug)),
  });
  const featureName = feature?.name || featureSlug;

  // Try embedding-based search
  const embedding = await generateEmbedding(message);
  let similar: any[];

  if (embedding) {
    const candidates = await db.execute(
      sql`SELECT l.*, 1 - (l.embedding <=> ${`[${embedding.join(',')}]`}::vector) as similarity,
                 f.slug as feature_slug, f.name as feature_name
          FROM locks l
          JOIN features f ON f.id = l.feature_id
          WHERE l.product_id = ${product.id}::uuid
            AND l.status = 'active'
            AND l.embedding IS NOT NULL
          ORDER BY l.embedding <=> ${`[${embedding.join(',')}]`}::vector
          LIMIT 5`
    );
    similar = (candidates.rows as any[]).filter((r) => r.similarity > 0.75);
  } else {
    // Text-based fallback
    const candidates = await db.execute(
      sql`SELECT l.*, f.slug as feature_slug, f.name as feature_name
          FROM locks l
          JOIN features f ON f.id = l.feature_id
          WHERE l.product_id = ${product.id}::uuid
            AND l.status = 'active'
          ORDER BY l.created_at DESC
          LIMIT 20`
    );
    similar = (candidates.rows as any[])
      .map((r) => ({ ...r, similarity: textSimilarity(message, r.message) }))
      .filter((r) => r.similarity > 0.4)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }

  if (similar.length === 0) {
    return { conflicts: [], supersession: { detected: false } };
  }

  // Classify all candidates via LLM (let the LLM explain the relationship)
  const classifications = await Promise.all(
    similar.map(async (candidate) => {
      const result = await classifyRelationship(
        {
          message: candidate.message,
          scope: candidate.scope,
          context: candidate.source_context,
          featureName: candidate.feature_name,
        },
        { message, scope, context: null, featureName }
      );
      return { candidate, result };
    })
  );

  const conflicts: ConflictResult[] = [];
  let supersession: SupersessionResult = { detected: false };

  for (const { candidate, result } of classifications) {
    if (result.relationship === 'potential_conflict' || result.relationship === 'related') {
      conflicts.push({
        lock: {
          short_id: candidate.short_id,
          message: candidate.message,
          scope: candidate.scope,
          feature: { slug: candidate.feature_slug, name: candidate.feature_name },
          created_at: candidate.created_at,
        },
        relationship: result.relationship,
        explanation: result.explanation,
      });
    } else if (result.relationship === 'supersession' && !supersession.detected) {
      supersession = {
        detected: true,
        supersedes: {
          short_id: candidate.short_id,
          message: candidate.message,
        },
        explanation: result.explanation,
      };
    }
  }

  return { conflicts, supersession };
}
