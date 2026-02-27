import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiPost } from '../lib/api-client.js';

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

const FACET_TITLES: Record<string, string> = {
  summary: 'Summary',
  principles: 'Principles',
  tensions: 'Tensions & Open Questions',
  trajectory: 'Trajectory',
};

function formatKnowledge(result: KnowledgeResult): string {
  if (result.message) {
    return result.message;
  }

  if (result.facets.length === 0) {
    const scope = result.feature
      ? `${result.product.name} / ${result.feature.name}`
      : result.product.name;
    return `No knowledge synthesized yet for ${scope}. Commit some decisions first.`;
  }

  const scope = result.feature
    ? `${result.product.name} / ${result.feature.name}`
    : result.product.name;

  const lines: string[] = [];
  lines.push(`# Knowledge — ${scope}`);
  lines.push('');

  for (const entry of result.facets) {
    const title = FACET_TITLES[entry.facet] ?? entry.facet;
    lines.push(`## ${title}`);
    lines.push('');
    lines.push(entry.content);
    lines.push('');
  }

  // Metadata footer
  const first = result.facets[0];
  if (first) {
    lines.push('---');
    lines.push(
      `Version ${first.version} | Based on ${first.lock_count_at_generation} decisions | Updated ${first.updated_at.slice(0, 10)}`,
    );
  }

  return lines.join('\n');
}

export function registerKnowledge(server: McpServer): void {
  server.registerTool(
    'lock_knowledge',
    {
      description: 'Get synthesized knowledge about a product — principles, tensions, and trajectory derived from recorded decisions.',
      inputSchema: {
        product: z.string().describe('Product slug (required)'),
        feature: z.string().optional().describe('Feature slug (optional — omit for product-level knowledge)'),
        regenerate: z.boolean().optional().describe('Force full regeneration from all decisions (default: false)'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ product, feature, regenerate }) => {
      try {
        let result: KnowledgeResult;

        if (regenerate) {
          result = await apiPost<KnowledgeResult>('/api/v1/knowledge/regenerate', {
            product,
            feature,
          });
        } else {
          const params = new URLSearchParams();
          params.set('product', product);
          if (feature) params.set('feature', feature);
          result = await apiGet<KnowledgeResult>(
            `/api/v1/knowledge?${params.toString()}`,
          );
        }

        const text = formatKnowledge(result);
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
