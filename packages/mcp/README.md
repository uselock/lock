# @uselock/mcp

MCP server for [Lock](https://github.com/uselock/lock) — give AI agents access to product decisions.

Lock captures product decisions with full context. This MCP server lets AI coding agents query and record decisions during development sessions.

## Setup

Add to your Claude Code or Cursor MCP config:

```json
{
  "mcpServers": {
    "lock": {
      "command": "npx",
      "args": ["@uselock/mcp"],
      "env": {
        "LOCK_API_URL": "http://localhost:3000",
        "LOCK_API_KEY": "lk_..."
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `lock_context` | Get all active decisions as markdown |
| `lock_check` | Pre-build constraint check against existing decisions |
| `lock_commit` | Record a new decision |
| `lock_query` | Filter decisions by product, feature, scope, status, tags |
| `lock_search_semantic` | Semantic search across decisions |
| `lock_get` | Get a single decision by ID |
| `lock_get_lineage` | Get the supersession/revert chain for a decision |
| `lock_list_products` | List all products |
| `lock_list_features` | List features (optionally filtered by product) |

## Documentation

Full documentation: [github.com/uselock/lock/tree/main/docs/mcp.md](https://github.com/uselock/lock/tree/main/docs/mcp.md)

## License

MIT
