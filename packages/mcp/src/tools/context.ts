import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet } from '../lib/api-client.js';
import type { Lock } from '../lib/types.js';

interface KnowledgeEntry {
  facet: string;
  content: string;
  version: number;
  lock_count_at_generation: number;
  updated_at: string;
}

interface KnowledgeResult {
  product: { slug: string; name: string };
  feature?: { slug: string; name: string };
  facets: KnowledgeEntry[];
  message?: string;
}

const SCOPE_WEIGHT: Record<string, number> = {
  architectural: 0,
  major: 1,
  minor: 2,
};

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function formatContext(locks: Lock[], product?: string): string {
  if (locks.length === 0) {
    return product
      ? `No active decisions found for product: ${product}`
      : 'No active decisions found.';
  }

  // Group by feature
  const byFeature = new Map<string, { name: string; locks: Lock[] }>();
  for (const lock of locks) {
    const key = lock.feature.slug;
    if (!byFeature.has(key)) {
      byFeature.set(key, { name: lock.feature.name, locks: [] });
    }
    byFeature.get(key)!.locks.push(lock);
  }

  // Sort locks within each feature by scope weight
  for (const group of byFeature.values()) {
    group.locks.sort(
      (a, b) => (SCOPE_WEIGHT[a.scope] ?? 2) - (SCOPE_WEIGHT[b.scope] ?? 2),
    );
  }

  const productName = locks[0].product.name;
  const featureCount = byFeature.size;
  const today = new Date().toISOString().slice(0, 10);

  // Type breakdown
  const typeCounts: Record<string, number> = {};
  for (const lock of locks) {
    if (lock.decision_type) {
      typeCounts[lock.decision_type] = (typeCounts[lock.decision_type] || 0) + 1;
    }
  }
  const typeBreakdown = Object.entries(typeCounts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  const lines: string[] = [];
  lines.push(`# Active Decisions — ${productName}`);
  lines.push(
    `Generated: ${today} | ${locks.length} decisions across ${featureCount} feature${featureCount === 1 ? '' : 's'}`,
  );
  if (typeBreakdown) {
    lines.push(`Types: ${typeBreakdown}`);
  }

  // Architectural constraints first
  const archLocks = locks.filter(l => l.scope === 'architectural');
  if (archLocks.length > 0) {
    lines.push('');
    lines.push('## ARCHITECTURAL CONSTRAINTS (must follow)');
    lines.push('');
    for (const lock of archLocks) {
      const typeBadge = lock.decision_type ? ` [${lock.decision_type}]` : '';
      lines.push(
        `[${lock.scope}]${typeBadge} ${lock.short_id}: ${lock.message} (${lock.author.name}, ${formatDate(lock.created_at)})`,
      );
    }
  }

  for (const [slug, group] of byFeature) {
    lines.push('');
    lines.push(`## ${slug} (${group.name})`);
    lines.push('');
    for (const lock of group.locks) {
      const typeBadge = lock.decision_type ? ` [${lock.decision_type}]` : '';
      lines.push(
        `[${lock.scope}]${typeBadge} ${lock.short_id}: ${lock.message} (${lock.author.name}, ${formatDate(lock.created_at)})`,
      );
    }
  }

  lines.push('');
  lines.push('IMPORTANT: Before contradicting these decisions, use lock_check to verify and lock_commit to record a superseding decision.');

  return lines.join('\n');
}

export function registerContext(server: McpServer): void {
  server.tool(
    'lock_context',
    'Returns all active decisions for a product as formatted text. Use this to understand what decisions have been made before building.',
    {
      product: z.string().optional().describe('Product slug to filter by'),
      feature: z.string().optional().describe('Feature slug to filter by'),
    },
    async ({ product, feature }) => {
      try {
        const params = new URLSearchParams();
        params.set('status', 'active');
        params.set('limit', '100');
        if (product) params.set('product', product);
        if (feature) params.set('feature', feature);

        const result = await apiGet<{ locks: Lock[] }>(
          `/api/v1/locks?${params.toString()}`,
        );

        // Try to prepend knowledge summary + principles
        let knowledgePreamble = '';
        if (product) {
          try {
            const kParams = new URLSearchParams();
            kParams.set('product', product);
            if (feature) kParams.set('feature', feature);
            const knowledge = await apiGet<KnowledgeResult>(
              `/api/v1/knowledge?${kParams.toString()}`,
            );
            if (knowledge.facets && knowledge.facets.length > 0) {
              const summary = knowledge.facets.find(f => f.facet === 'summary');
              const principles = knowledge.facets.find(f => f.facet === 'principles');
              if (summary || principles) {
                const parts: string[] = [];
                if (summary) {
                  parts.push('## Product Understanding\n');
                  parts.push(summary.content);
                }
                if (principles) {
                  parts.push('\n## Key Principles\n');
                  parts.push(principles.content);
                }
                parts.push('\n---\n');
                knowledgePreamble = parts.join('\n');
              }
            }
          } catch {
            // Knowledge not available — continue without it
          }
        }

        const text = knowledgePreamble + formatContext(result.locks ?? [], product);
        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
