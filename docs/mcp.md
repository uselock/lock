# MCP Server (AI Agents)

The Lock MCP server gives AI agents (Claude Code, Cursor, Windsurf, etc.) direct access to your team's product decisions. Agents can read existing decisions before writing code and record new decisions as they work.

The server includes built-in `instructions` that teach agents the workflow automatically — no CLAUDE.md or per-editor config needed. When an agent connects, it learns to:

1. **Call `lock_check` before building** — checks for constraints that apply to the planned work
2. **Call `lock_commit` after deciding** — records choices between approaches, conventions, or constraints
3. **Call `lock_context` for orientation** — gets all active decisions for a product

## Why Give AI Agents Access to Decisions?

Without Lock, AI agents write code in a vacuum. They don't know that your team decided to "use notional value instead of margin" or that "all public APIs must use pagination." With Lock's MCP server, agents can:

- **Check constraints** before implementing a feature
- **Respect architectural decisions** made by the team
- **Record decisions** they make during implementation
- **Search for context** when working in unfamiliar areas

## Setup

### Recommended: via Lock CLI

```bash
lock login          # authenticate (once per machine)
cd ~/your-project
lock init           # detects Claude Code/Cursor, configures automatically
```

`lock init` detects your IDE and offers to:
- **Claude Code**: write `.mcp.json` + install a `/lock` skill to `.claude/skills/lock.md`
- **Cursor**: write `.cursor/mcp.json`

Credentials are read from `~/.lock/credentials` (written by `lock login`), so `.mcp.json` contains no secrets and is safe to commit.

Use `lock init --skip-ide` to bypass IDE detection (e.g. in CI).

### Manual: Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "lock": {
      "command": "npx",
      "args": ["@uselock/mcp"],
      "env": {
        "LOCK_API_URL": "https://your-lock-instance.com",
        "LOCK_API_KEY": "lk_your_api_key"
      }
    }
  }
}
```

### Manual: Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "lock": {
      "command": "npx",
      "args": ["@uselock/mcp"],
      "env": {
        "LOCK_API_URL": "https://your-lock-instance.com",
        "LOCK_API_KEY": "lk_your_api_key"
      }
    }
  }
}
```

### Credentials

The MCP server resolves credentials in this order:

1. **Environment variables** (`LOCK_API_URL`, `LOCK_API_KEY`) — highest priority
2. **`~/.lock/credentials`** — JSON file written by `lock login`
3. **Defaults** — `http://localhost:3000`, no key

| Variable | Description | Default |
|----------|-------------|---------|
| `LOCK_API_URL` | Lock core API URL | `http://localhost:3000` |
| `LOCK_API_KEY` | API key for authentication | — |

---

## Tools

### Read Tools

#### `lock_list_products`

List all products in the workspace with decision counts.

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

Filter and list decisions by product, feature, scope, status, or tags.

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

Get a single decision by its short ID (e.g. `l-a7f3e2`) or UUID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `lock_id` | string | Yes | Short ID (e.g., `l-a7f3e2`) or UUID |

**Returns:** Full lock object with metadata, tags, links, lineage, and source context.

---

#### `lock_get_lineage`

Get the supersession and revert history of a decision.

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

Search decisions by meaning. Use when you need to find decisions related to a concept rather than filtering by exact fields.

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

Record a product decision. Call this after choosing between approaches, setting a convention, or establishing a constraint that future code should follow.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | string | Yes | The decision statement as a clear sentence — e.g. "Use WebSockets instead of polling for real-time updates" |
| `product` | string | No | Product slug |
| `feature` | string | No | Feature slug |
| `scope` | string | No | Impact level: `minor` (default) for local choices, `major` for cross-feature, `architectural` for system-wide constraints |
| `decision_type` | string | No | Category (auto-inferred if omitted): `product`, `technical`, `business`, `design`, or `process` |
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

### Context Tools

These tools return formatted Markdown optimized for agent consumption.

#### `lock_context`

Get all active decisions for a product. Use this to understand the full decision landscape before making changes.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `product` | string | No | Product slug to filter by |
| `feature` | string | No | Feature slug to filter by |

**Returns:** Markdown with architectural constraints highlighted, decisions grouped by feature, and knowledge summary (if available).

---

#### `lock_check`

Check for existing decisions that constrain what you're about to build. CALL THIS BEFORE implementing any feature, refactor, or architectural change.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `intent` | string | Yes | Describe what you are about to build or change — e.g. "add real-time price updates to the trading dashboard" |
| `product` | string | No | Product slug to scope the search to |
| `feature` | string | No | Feature slug to scope the search to |

**Returns:** Markdown with BLOCKING decisions (architectural/major) and informational decisions (minor).

---

#### `lock_recap`

Summarize recent decisions with scope/type breakdowns and key highlights.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `product` | string | No | Product slug to filter by (omit for org-wide) |
| `since` | string | No | ISO date string — only include decisions after this date (default: 7 days ago) |

**Returns:** Markdown summary with totals, scope/type breakdown, top contributors, and key decisions.

---

#### `lock_knowledge`

Get synthesized knowledge about a product — principles, tensions, and trajectory derived from recorded decisions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `product` | string | Yes | Product slug |
| `feature` | string | No | Feature slug (omit for product-level knowledge) |
| `regenerate` | boolean | No | Force full regeneration from all decisions (default: false) |

**Returns:** Markdown with summary, principles, tensions & open questions, and trajectory.

---

## Usage Patterns

With the built-in server instructions, agents should call `lock_check` and `lock_commit` automatically. You can also prompt them explicitly:

### Before Starting Work

```
"Before implementing the caching layer, check Lock for any existing
decisions about caching, performance, or infrastructure."
```

The agent will call `lock_check` to find relevant constraints and factor them into the implementation.

### During Implementation

When the agent makes a significant design choice:

```
"Record the decision to use Redis with a 15-minute TTL for session caching."
```

The agent will call `lock_commit` to record the decision. Lock automatically checks for conflicts and supersessions.

### Getting Context for a Product

```
"What are the active architectural decisions for the trading product?"
```

The agent will call `lock_context` with `product: "trading"` to get all active decisions, or `lock_query` with `scope: "architectural"` for just the high-level ones.
