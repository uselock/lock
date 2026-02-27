import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiPost } from '../lib/api-client.js';
import type { CommitResponse } from '../lib/types.js';

export function registerCommit(server: McpServer): void {
  server.registerTool(
    'lock_commit',
    {
      description: 'Record a product decision. Call this after choosing between approaches, setting a convention, or establishing a constraint that future code should follow.',
      inputSchema: {
        message: z.string().describe('The decision statement as a clear sentence — e.g. "Use WebSockets instead of polling for real-time updates"'),
        product: z.string().optional().describe('Product slug (e.g. "trading")'),
        feature: z.string().optional().describe('Feature slug (e.g. "margin-rework")'),
        scope: z
          .enum(['minor', 'major', 'architectural'])
          .optional()
          .describe('Impact level: "minor" (default) for local choices, "major" for cross-feature, "architectural" for system-wide constraints'),
        tags: z.array(z.string()).optional().describe('Tags for categorizing the decision'),
        decision_type: z
          .enum(['product', 'technical', 'business', 'design', 'process'])
          .optional()
          .describe('Category (auto-inferred if omitted): product, technical, business, design, or process'),
        source: z
          .string()
          .optional()
          .describe('Source reference (e.g. session ID, URL)'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ message, product, feature, scope, tags, decision_type, source }) => {
      try {
        const body: Record<string, unknown> = {
          message,
          author: {
            type: 'agent',
            id: 'mcp-agent',
            name: 'MCP Agent',
            source: 'mcp',
          },
          source: {
            type: 'agent_session',
            ref: source,
          },
        };

        if (product) body.product = product;
        if (feature) body.feature = feature;
        if (scope) body.scope = scope;
        if (tags && tags.length > 0) body.tags = tags;
        if (decision_type) body.decision_type = decision_type;

        const result = await apiPost<CommitResponse>('/api/v1/locks', body);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  lock: result.lock,
                  conflicts: result.conflicts,
                  ...(result.supersession ? { supersession: result.supersession } : {}),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message_ = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message_}` }],
          isError: true,
        };
      }
    },
  );
}
