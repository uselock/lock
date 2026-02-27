import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiGet } from '../lib/api-client.js';
import type { Product } from '../lib/types.js';

export function registerListProducts(server: McpServer): void {
  server.registerTool(
    'lock_list_products',
    {
      description: 'List all products in the workspace with decision counts.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const result = await apiGet<{ products: Product[] }>('/api/v1/products');
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ products: result.products }, null, 2),
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
