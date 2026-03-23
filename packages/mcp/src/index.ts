#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerListProducts } from './tools/list-products.js';
import { registerListFeatures } from './tools/list-features.js';
import { registerQuery } from './tools/query.js';
import { registerGet } from './tools/get.js';
import { registerGetLineage } from './tools/get-lineage.js';
import { registerSearchSemantic } from './tools/search-semantic.js';
import { registerCommit } from './tools/commit.js';
import { registerContext } from './tools/context.js';
import { registerCheck } from './tools/check.js';
import { registerRecap } from './tools/recap.js';
import { registerKnowledge } from './tools/knowledge.js';
import { registerCreateProduct } from './tools/create-product.js';
import { registerCreateFeature } from './tools/create-feature.js';

const server = new McpServer(
  {
    name: 'lock',
    version: '0.1.0',
    description: 'Lock — decision tracking for product teams. Records architectural choices, scope changes, and trade-offs so teams know why things were built a certain way.',
  },
  {
    instructions: [
      'Lock tracks product decisions — architectural choices, scope changes, trade-offs — so teams know why things were built a certain way.',
      '',
      'Workflow:',
      '1. BEFORE building: Call lock_check with what you\'re about to do. Follow any BLOCKING decisions.',
      '2. AFTER deciding: Call lock_commit when you choose between approaches, set a convention, or establish a constraint.',
      '3. To understand the current state: Call lock_context for all active decisions.',
      '',
      'What counts as a decision: choosing between approaches, establishing conventions, setting constraints, changing or reversing a previous decision.',
      'What is NOT a decision: bug fixes, refactors, routine implementation, variable naming.',
      '',
      'When working with tool results, write down any important information you might need later in your response, as the original tool result may be cleared later.',
      '',
      'Bootstrap: If no products exist yet, use lock_create_product to create one. Use lock_create_feature to add features within a product.',
    ].join('\n'),
  },
);

// Register all tools
registerListProducts(server);
registerListFeatures(server);
registerQuery(server);
registerGet(server);
registerGetLineage(server);
registerSearchSemantic(server);
registerCommit(server);
registerContext(server);
registerCheck(server);
registerRecap(server);
registerKnowledge(server);
registerCreateProduct(server);
registerCreateFeature(server);

// Connect via stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Failed to start Lock MCP server:', err);
  process.exit(1);
});
