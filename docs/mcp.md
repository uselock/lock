# MCP Server (AI Agents)

The Lock MCP server gives AI agents (Claude Code, Cursor, Windsurf, etc.) direct access to your team's product decisions. Agents can read existing decisions before writing code and record new decisions as they work.

## Why Give AI Agents Access to Decisions?

Without Lock, AI agents write code in a vacuum. They don't know that your team decided to "use notional value instead of margin" or that "all public APIs must use pagination." With Lock's MCP server, agents can:

- **Check constraints** before implementing a feature
- **Respect architectural decisions** made by the team
- **Record decisions** they make during implementation
- **Search for context** when working in unfamiliar areas

## Setup

### Claude Code

Add to your project's `.mcp.json` or global MCP config:

```json
{
  "mcpServers": {
    "lock": {
      "command": "npx",
      "args": ["@uselock/mcp-server"],
      "env": {
        "LOCK_API_URL": "https://your-lock-instance.com",
        "LOCK_API_KEY": "lk_your_api_key"
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "lock": {
      "command": "npx",
      "args": ["@uselock/mcp-server"],
      "env": {
        "LOCK_API_URL": "https://your-lock-instance.com",
        "LOCK_API_KEY": "lk_your_api_key"
      }
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOCK_API_URL` | Lock core API URL | `http://localhost:3000` |
| `LOCK_API_KEY` | API key for authentication | — |

---

## Tools

### Read Tools

#### `lock_list_products`

List all products in the workspace with their decision counts.

**Parameters:** None

**Returns:**
```json
{
  "products": [
    {
      "slug": "trading",
      "name": "Trading",
      "description": "Core trading platform",
      "decision_count": 12,
      "created_at": "2026-02-01T..."
    }
  ]
}
```

---

#### `lock_list_features`

List features, optionally filtered by product.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `product` | string | No | Product slug to filter by |

**Returns:**
```json
{
  "features": [
    {
      "slug": "margin-rework",
      "name": "Margin Rework",
      "description": "Migrating to notional value",
      "product_slug": "trading",
      "created_at": "2026-02-01T..."
    }
  ]
}
```

---

#### `lock_query`

Query and filter decisions with multiple criteria.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `product` | string | No | Product slug |
| `feature` | string | No | Feature slug |
| `tags` | string[] | No | Filter by tags |
| `scope` | string | No | `minor`, `major`, or `architectural` |
| `status` | string | No | `active`, `superseded`, `reverted`, `proposed`, or `auto` |
| `limit` | number | No | Max results |

**Returns:**
```json
{
  "locks": [
    {
      "short_id": "l-a7f3e2",
      "message": "Use notional value instead of margin",
      "product": { "slug": "trading", "name": "Trading" },
      "feature": { "slug": "margin-rework", "name": "Margin Rework" },
      "scope": "major",
      "status": "active",
      "author": { "name": "philippe", "source": "slack" },
      "created_at": "2026-02-15T..."
    }
  ]
}
```

---

#### `lock_get`

Get full details of a single decision by its short ID or UUID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `lock_id` | string | Yes | Short ID (e.g., `l-a7f3e2`) or UUID |

**Returns:** Full lock object with metadata, tags, links, lineage, and source context.

---

#### `lock_get_lineage`

Get the full supersession and revert history chain of a decision.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `lock_id` | string | Yes | Short ID or UUID |

**Returns:**
```json
{
  "chain": [
    {
      "short_id": "l-x9y2z3",
      "message": "Use margin for position display",
      "status": "superseded",
      "relationship": "root",
      "created_at": "2026-01-10T..."
    },
    {
      "short_id": "l-a7f3e2",
      "message": "Use notional value instead of margin",
      "status": "active",
      "relationship": "supersedes",
      "created_at": "2026-02-15T..."
    }
  ]
}
```

---

#### `lock_search_semantic`

Semantic search across decisions using natural language. Finds decisions similar in meaning to the query, even if the exact words don't match.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Natural language search query |
| `product` | string | No | Product slug to scope search |
| `feature` | string | No | Feature slug to scope search |

**Returns:** Array of matching locks sorted by relevance.

---

### Write Tools

#### `lock_commit`

Record a new product decision. Automatically checks for conflicts with existing decisions and detects supersessions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | string | Yes | The decision statement |
| `product` | string | No | Product slug |
| `feature` | string | No | Feature slug |
| `scope` | string | No | `minor`, `major`, or `architectural` (default: `minor`) |
| `tags` | string[] | No | Tags for categorization |
| `source` | string | No | Source reference (e.g., session ID) |

**Returns:**
```json
{
  "lock": {
    "short_id": "l-d4e5f6",
    "message": "Use WebSockets for real-time updates",
    "scope": "major",
    "status": "active",
    "product": { "slug": "trading", "name": "Trading" },
    "feature": { "slug": "real-time", "name": "Real Time" }
  },
  "conflicts": [
    {
      "lock": { "short_id": "l-a1b2c3", "message": "Use SSE for live data" },
      "relationship": "potential_conflict",
      "explanation": "Both decisions address real-time data delivery but propose different protocols."
    }
  ],
  "supersession": {
    "detected": true,
    "supersedes": { "short_id": "l-x9y2z3", "message": "Use polling for updates" },
    "explanation": "The new decision replaces polling with WebSockets."
  }
}
```

All decisions committed via MCP are authored as `MCP Agent` with source type `agent_session`. If the lock doesn't originate from Slack, a notification is posted to the relevant Slack channel.

---

## Usage Patterns

### Before Starting Work

Have the agent check for existing constraints:

```
"Before implementing the caching layer, check Lock for any existing
decisions about caching, performance, or infrastructure."
```

The agent will use `lock_search_semantic` or `lock_query` to find relevant decisions and factor them into the implementation.

### During Implementation

When the agent makes a significant design choice, have it record the decision:

```
"Record the decision to use Redis with a 15-minute TTL for session caching."
```

The agent will use `lock_commit` to record the decision, and Lock will automatically check for conflicts.

### Getting Context for a Product

```
"What are the active architectural decisions for the trading product?"
```

The agent will use `lock_query` with `product: "trading"` and `scope: "architectural"` to retrieve high-level decisions.
