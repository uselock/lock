import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiPost } from '../lib/api-client.js';

interface Feature {
  slug: string;
  name: string;
  description: string | null;
  product: { slug: string; name: string };
  created_at: string;
}

export function registerCreateFeature(server: McpServer) {
  server.registerTool(
    'lock_create_feature',
    {
      title: 'Create Feature',
      description: 'Create a new feature within a product to scope decisions to.',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        slug: z.string().describe('URL-friendly identifier (e.g. "margin-rework", "auth")'),
        name: z.string().describe('Display name (e.g. "Margin Rework", "Authentication")'),
        product: z.string().describe('Product slug this feature belongs to (e.g. "trading")'),
        description: z.string().optional().describe('Optional description of the feature'),
      },
    },
    async ({ slug, name, product, description }) => {
      try {
        const body: Record<string, string> = { slug, name, product };
        if (description) body.description = description;

        const result = await apiPost<{ data: Feature }>('/api/v1/features', body);
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
