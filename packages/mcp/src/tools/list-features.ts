import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet } from '../lib/api-client.js';
import type { Feature } from '../lib/types.js';

export function registerListFeatures(server: McpServer): void {
  server.registerTool(
    'lock_list_features',
    {
      description: 'List features, optionally filtered by product.',
      inputSchema: {
        product: z.string().optional().describe('Product slug to filter features by'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ product }) => {
      try {
        const query = product ? `?product=${encodeURIComponent(product)}` : '';
        const result = await apiGet<{ features: Feature[] }>(`/api/v1/features${query}`);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ features: result.features }, null, 2),
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
