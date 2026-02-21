import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiPost } from '../lib/api-client.js';
import type { Lock } from '../lib/types.js';

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function formatCheck(locks: Lock[], intent: string): string {
  if (locks.length === 0) {
    return 'No relevant decisions found. Proceed as planned.';
  }

  // Split into blocking (architectural + major) and informational (minor)
  const blocking = locks.filter(l => l.scope === 'architectural' || l.scope === 'major');
  const informational = locks.filter(l => l.scope === 'minor');

  const lines: string[] = [];
  lines.push('# Relevant Decisions');
  lines.push('');
  lines.push(`Intent: "${intent}"`);

  if (blocking.length > 0) {
    lines.push('');
    lines.push('## BLOCKING');
    lines.push('');
    for (let i = 0; i < blocking.length; i++) {
      const lock = blocking[i];
      const typeBadge = lock.decision_type ? ` [${lock.decision_type}]` : '';
      lines.push(
        `${i + 1}. [${lock.scope}]${typeBadge} ${lock.short_id}: ${lock.message}`,
      );
      lines.push(
        `   Feature: ${lock.feature.slug} | Author: ${lock.author.name} | ${formatDate(lock.created_at)}`,
      );
    }
    lines.push('');
    lines.push(
      'WARNING: These are architectural/major decisions. If your work contradicts them, you MUST use lock_commit to record a superseding decision before proceeding.',
    );
  }

  if (informational.length > 0) {
    lines.push('');
    lines.push('## Informational');
    lines.push('');
    for (let i = 0; i < informational.length; i++) {
      const lock = informational[i];
      const typeBadge = lock.decision_type ? ` [${lock.decision_type}]` : '';
      lines.push(
        `${i + 1}. [${lock.scope}]${typeBadge} ${lock.short_id}: ${lock.message}`,
      );
      lines.push(
        `   Feature: ${lock.feature.slug} | Author: ${lock.author.name} | ${formatDate(lock.created_at)}`,
      );
    }
  }

  if (blocking.length === 0) {
    lines.push('');
    lines.push(
      'If your work contradicts a decision, use lock_commit to record a superseding decision.',
    );
  }

  return lines.join('\n');
}

export function registerCheck(server: McpServer): void {
  server.tool(
    'lock_check',
    'Search for existing decisions relevant to what you are about to build. Use before starting work to check for constraints.',
    {
      intent: z
        .string()
        .describe('What you are about to build or change'),
      product: z
        .string()
        .optional()
        .describe('Product slug to scope the search to'),
      feature: z
        .string()
        .optional()
        .describe('Feature slug to scope the search to'),
    },
    async ({ intent, product, feature }) => {
      try {
        const body: Record<string, string> = { query: intent };
        if (product) body.product = product;
        if (feature) body.feature = feature;

        const result = await apiPost<{ locks: Lock[] }>(
          '/api/v1/locks/search',
          body,
        );
        const text = formatCheck(result.locks ?? [], intent);
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
