import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet } from '../lib/api-client.js';
import type { Lock } from '../lib/types.js';

export function registerQuery(server: McpServer): void {
  server.tool(
    'lock_query',
    'Query and filter locks (decisions) by product, feature, tags, scope, status, and limit',
    {
      product: z.string().optional().describe('Product slug to filter by'),
      feature: z.string().optional().describe('Feature slug to filter by'),
      tags: z.array(z.string()).optional().describe('Tags to filter by'),
      scope: z
        .enum(['minor', 'major', 'architectural'])
        .optional()
        .describe('Scope to filter by'),
      decision_type: z
        .enum(['product', 'technical', 'business', 'design', 'process'])
        .optional()
        .describe('Decision type to filter by'),
      status: z
        .enum(['active', 'superseded', 'reverted', 'proposed', 'auto'])
        .optional()
        .describe('Status to filter by'),
      limit: z.number().optional().describe('Maximum number of results to return'),
    },
    async ({ product, feature, tags, scope, decision_type, status, limit }) => {
      try {
        const params = new URLSearchParams();
        if (product) params.set('product', product);
        if (feature) params.set('feature', feature);
        if (scope) params.set('scope', scope);
        if (decision_type) params.set('decision_type', decision_type);
        if (status) params.set('status', status);
        if (limit !== undefined) params.set('limit', String(limit));
        if (tags && tags.length > 0) {
          for (const tag of tags) {
            params.append('tags', tag);
          }
        }

        const query = params.toString() ? `?${params.toString()}` : '';
        const result = await apiGet<{ locks: Lock[] }>(`/api/v1/locks${query}`);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ locks: result.locks }, null, 2),
            },
          ],
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
