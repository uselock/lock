import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet } from '../lib/api-client.js';

interface RecapResult {
  period: { from: string; to: string };
  summary: {
    total_decisions: number;
    by_scope: Record<string, number>;
    by_type: Record<string, number>;
    by_product: { slug: string; name: string; count: number }[];
    reverts: number;
    supersessions: number;
  };
  decisions: any[];
  top_contributors: { name: string; count: number }[];
}

function formatRecap(recap: RecapResult, product?: string): string {
  const { period, summary, decisions, top_contributors } = recap;

  if (summary.total_decisions === 0) {
    return 'No decisions found for this period.';
  }

  const fromDate = period.from.slice(0, 10);
  const toDate = period.to.slice(0, 10);

  const lines: string[] = [];
  const title = product ? `Decision Recap — ${product}` : 'Decision Recap — All Products';
  lines.push(`# ${title}`);
  lines.push(`Period: ${fromDate} to ${toDate}`);
  lines.push(`Total: ${summary.total_decisions} decisions`);

  // Scope breakdown
  const scopeStr = Object.entries(summary.by_scope)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  if (scopeStr) lines.push(`Scopes: ${scopeStr}`);

  // Type breakdown
  const typeStr = Object.entries(summary.by_type)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  if (typeStr) lines.push(`Types: ${typeStr}`);

  if (summary.reverts > 0) lines.push(`Reverts: ${summary.reverts}`);
  if (summary.supersessions > 0) lines.push(`Supersessions: ${summary.supersessions}`);

  // By product (for org-wide)
  if (!product && summary.by_product.length > 0) {
    lines.push('');
    lines.push('## By Product');
    for (const p of summary.by_product) {
      lines.push(`- ${p.name} (${p.slug}): ${p.count} decisions`);
    }
  }

  // Top contributors
  if (top_contributors.length > 0) {
    lines.push('');
    lines.push('## Top Contributors');
    for (const c of top_contributors) {
      lines.push(`- ${c.name}: ${c.count} decisions`);
    }
  }

  // Key decisions
  const keyDecisions = decisions
    .filter((d: any) => d.scope === 'architectural' || d.scope === 'major')
    .slice(0, 5);

  if (keyDecisions.length > 0) {
    lines.push('');
    lines.push('## Key Decisions');
    for (const lock of keyDecisions) {
      const typeBadge = lock.decision_type ? ` [${lock.decision_type}]` : '';
      lines.push(
        `- [${lock.scope}]${typeBadge} ${lock.short_id}: ${lock.message} (${lock.author?.name || 'unknown'}, ${lock.feature?.name || 'unknown'})`,
      );
    }
  }

  return lines.join('\n');
}

export function registerRecap(server: McpServer): void {
  server.registerTool(
    'lock_recap',
    {
      description: 'Summarize recent decisions with scope/type breakdowns and key highlights.',
      inputSchema: {
        product: z.string().optional().describe('Product slug to filter by (omit for org-wide)'),
        since: z.string().optional().describe('ISO date string — only include decisions after this date (default: 7 days ago)'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ product, since }) => {
      try {
        const params = new URLSearchParams();
        if (product) params.set('product', product);
        if (since) params.set('since', since);

        const query = params.toString() ? `?${params.toString()}` : '';
        const result = await apiGet<RecapResult>(`/api/v1/locks/recap${query}`);
        const text = formatRecap(result, product);
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
