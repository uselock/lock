import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiPost } from '../lib/api-client.js';

interface Product {
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
}

export function registerCreateProduct(server: McpServer) {
  server.registerTool(
    'lock_create_product',
    {
      title: 'Create Product',
      description: 'Create a new product to organize decisions under.',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        slug: z.string().describe('URL-friendly identifier (e.g. "trading", "lockitself")'),
        name: z.string().describe('Display name (e.g. "Trading", "Lock Itself")'),
        description: z.string().optional().describe('Optional description of the product'),
      },
    },
    async ({ slug, name, description }) => {
      try {
        const body: Record<string, string> = { slug, name };
        if (description) body.description = description;

        const result = await apiPost<{ data: Product }>('/api/v1/products', body);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );
}
