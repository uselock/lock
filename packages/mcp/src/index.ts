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

const server = new McpServer({
  name: 'lock',
  version: '0.1.0',
});

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

// Connect via stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Failed to start Lock MCP server:', err);
  process.exit(1);
});
