import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiPost } from '../lib/api-client.js';
import type { CommitResponse } from '../lib/types.js';

export function registerCommit(server: McpServer): void {
  server.tool(
    'lock_commit',
    'Commit a new lock (decision). Records a product decision with full context and checks for conflicts.',
    {
      message: z.string().describe('The decision statement to record'),
      product: z.string().optional().describe('Product slug (e.g. "trading")'),
      feature: z.string().optional().describe('Feature slug (e.g. "margin-rework")'),
      scope: z
        .enum(['minor', 'major', 'architectural'])
        .optional()
        .describe('Scope of the decision (default: minor)'),
      tags: z.array(z.string()).optional().describe('Tags for categorizing the decision'),
      decision_type: z
        .enum(['product', 'technical', 'business', 'design', 'process'])
        .optional()
        .describe('Decision type (auto-inferred if not provided)'),
      source: z
        .string()
        .optional()
        .describe('Source reference (e.g. session ID, URL)'),
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
