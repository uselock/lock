# Documentation Update Instructions

This file describes all changes needed to bring the Lock documentation in sync with the current codebase. The docs are out of date — several features, endpoints, and commands were added after the docs were last written.

Apply every change listed below. Each section specifies the file, what to add/change, and where.

---

## 1. `docs/index.md` — Home / Overview

### 1a. Add Knowledge System to "Core Concepts" bullet list

After the bullet about conflict detection, add:

```markdown
- **Knowledge synthesis** lets Lock understand your product — not just store decisions. Lock synthesizes all decisions into living summaries, principles, tensions, and trajectory that update with every commit.
```

### 1b. Add Decision Types to "Core Concepts" bullet list

After the bullet about scopes, add:

```markdown
- **Decision types** classify decisions as `product`, `technical`, `business`, `design`, or `process` — auto-inferred by LLM if not specified.
```

### 1c. Update "What Happens When You Lock a Decision"

Add step between step 3 and 4:

```
  3b. Infers the decision type (product, technical, business, design, or process)
```

And add a new step at the end:

```
  6. Updates synthesized knowledge for the product and feature
```

### 1d. Add Knowledge to the Documentation links

Add to the bottom of the documentation list:

```markdown
- [Knowledge System](/docs/concepts#knowledge-synthesis) — Living product understanding from your decisions
```

### 1e. Add `lock knowledge` to CLI Quick Start

After the `lock "Cache user sessions..."` example, add:

```bash
# View synthesized knowledge
lock knowledge --product my-product
```

### 1f. Update the MCP tools list description

Change:
```
Your AI agent will automatically check existing decisions before writing code.
```
To:
```
Your AI agent will check existing decisions, read synthesized product knowledge, and record its own decisions as it works.
```

---

## 2. `docs/concepts.md` — Core Concepts

### 2a. Add "Decision Types" section

Add a new section after "Statuses" (before the "Products" section):

```markdown
---

## Decision Types

Every lock can have a **decision type** that classifies what kind of decision it is:

| Type | When to Use |
|------|-------------|
| `product` | User-facing features, behavior, requirements, UX flows |
| `technical` | Engineering, infrastructure, architecture, tooling, performance |
| `business` | Pricing, strategy, metrics, KPIs, partnerships |
| `design` | UI/UX, visual design, branding, layout |
| `process` | Team workflow, methodology, communication, documentation |

Decision types are **auto-inferred by LLM** if not specified explicitly. You can also set them manually:

```
@lock Use Redis for caching --type technical
lock commit "Switch to flat pricing" --type business
```

Types are useful for filtering (`lock log --type technical`) and appear in recaps and knowledge synthesis.
```

### 2b. Add "Knowledge Synthesis" section

Add a new section after "Cross-Surface Awareness" (before "Authentication"):

```markdown
---

## Knowledge Synthesis

Lock doesn't just store decisions — it **synthesizes them into living product knowledge** that evolves with every commit.

### Four Facets

| Facet | Content |
|-------|---------|
| **Summary** | 2-3 paragraph overview of the current state and evolution |
| **Principles** | Bullet list of constraints, invariants, and design rules |
| **Tensions** | Open questions, unresolved debates, areas of flux |
| **Trajectory** | Direction based on recent patterns and trends |

### How It Works

1. Every time a decision is committed or reverted, Lock updates knowledge **incrementally** — the LLM reads existing knowledge + the new decision + 10 recent decisions and produces an updated synthesis
2. Knowledge exists at two levels: **feature-level** (decisions within a feature) and **product-level** (all decisions across features)
3. If knowledge becomes stale (decision count drifts >50% from last generation), it's regenerated on the next read
4. You can force a full regeneration at any time

### Accessing Knowledge

- **Slack:** `@lock knowledge --product trading`
- **CLI:** `lock knowledge --product trading --feature margin-rework`
- **MCP:** `lock_knowledge` tool
- **API:** `GET /api/v1/knowledge?product=trading`
- **Export:** `lock export --with-knowledge` prepends knowledge sections to LOCK.md

### Graceful Degradation

Without an LLM provider (OpenAI or Anthropic API key), knowledge synthesis is unavailable. The API returns empty facets with a message explaining that an LLM is required. This never blocks commits or other operations.
```

### 2c. Update "Locks (Decisions)" table

Add `decision_type` to the field table:

```markdown
| **Decision Type** | Classification: `product`, `technical`, `business`, `design`, or `process` |
```

---

## 3. `docs/api.md` — REST API Reference

### 3a. Add `decision_type` to Create Lock request

Add to the request body table:

```markdown
| `decision_type` | string | No | `product`, `technical`, `business`, `design`, or `process`. Auto-inferred if omitted. |
```

### 3b. Add `decision_type` to PATCH endpoint

Update the PATCH request body table to include:

```markdown
| `decision_type` | string | No | `product`, `technical`, `business`, `design`, or `process` |
```

### 3c. Add `decision_type` to List Locks query params

Add to the query parameters table:

```markdown
| `decision_type` | string | Filter by decision type |
```

### 3d. Add Recap endpoint

Add after the Semantic Search section:

```markdown
---

### Recap

```
GET /api/v1/locks/recap
```

Get an aggregated summary of recent decisions.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `product` | string | Filter by product slug |
| `since` | string | ISO date — only include decisions after this date (default: 7 days ago) |
| `limit` | number | Max decisions to include (default: 100) |

**Response (200):**

```json
{
  "data": {
    "period": { "from": "2026-02-14T...", "to": "2026-02-21T..." },
    "summary": {
      "total_decisions": 15,
      "by_scope": { "minor": 8, "major": 5, "architectural": 2 },
      "by_type": { "technical": 7, "product": 5, "business": 3 },
      "by_product": [{ "slug": "trading", "name": "Trading", "count": 15 }],
      "reverts": 1,
      "supersessions": 2
    },
    "decisions": [...],
    "top_contributors": [{ "name": "philippe", "count": 8 }]
  }
}
```
```

### 3e. Add Pre-Check endpoint

Add after Recap:

```markdown
---

### Pre-Check Conflicts

```
POST /api/v1/locks/pre-check
```

Check for potential conflicts before committing a decision. Same as conflict detection but without creating a lock.

**Request body:**

```json
{
  "message": "Switch to GraphQL for all APIs",
  "product": "trading",
  "feature": "api-v2",
  "scope": "major"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | The decision to check |
| `product` | string | Yes | Product slug |
| `feature` | string | Yes | Feature slug |
| `scope` | string | No | Scope (default: `minor`) |

**Response (200):** Same format as the `conflicts` array in the commit response.
```

### 3f. Add Batch Extract endpoint

Add after Pre-Check:

```markdown
---

### Batch Extract Decisions

```
POST /api/v1/locks/extract-batch
```

Extract multiple decisions from a batch of messages (used by Slack import).

**Request body:**

```json
{
  "messages": [
    { "text": "let's use Redis", "author": "philippe", "timestamp": "2026-02-15T..." },
    { "text": "agreed, with a 15 min TTL", "author": "alice", "timestamp": "2026-02-15T..." }
  ],
  "product": "trading",
  "feature": "caching"
}
```

**Response (200):**

```json
{
  "data": {
    "decisions": [
      {
        "decision": "Use Redis with a 15-minute TTL for caching",
        "scope": "major",
        "decision_type": "technical",
        "tags": ["caching", "redis"],
        "confidence": 0.88,
        "reasoning": "Team agreed on Redis with specific TTL"
      }
    ]
  }
}
```
```

### 3g. Add Knowledge endpoints section

Add a new top-level section after Channel Configs:

```markdown
---

## Knowledge

### Get Knowledge

```
GET /api/v1/knowledge
```

Get synthesized knowledge for a product or feature. Generates on-demand if missing or stale.

**Query parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `product` | string | Yes | Product slug |
| `feature` | string | No | Feature slug (omit for product-level knowledge) |

**Response (200):**

```json
{
  "data": {
    "product": { "slug": "trading", "name": "Trading" },
    "feature": { "slug": "margin-rework", "name": "Margin Rework" },
    "facets": [
      {
        "facet": "summary",
        "content": "The trading platform has evolved from...",
        "version": 3,
        "lock_count_at_generation": 47,
        "updated_at": "2026-02-21T14:00:00Z"
      },
      {
        "facet": "principles",
        "content": "- All position values must support both...",
        "version": 3,
        "lock_count_at_generation": 47,
        "updated_at": "2026-02-21T14:00:00Z"
      },
      {
        "facet": "tensions",
        "content": "- Unresolved: whether portfolio-level...",
        "version": 3,
        "lock_count_at_generation": 47,
        "updated_at": "2026-02-21T14:00:00Z"
      },
      {
        "facet": "trajectory",
        "content": "Recent decisions show a move toward...",
        "version": 3,
        "lock_count_at_generation": 47,
        "updated_at": "2026-02-21T14:00:00Z"
      }
    ]
  }
}
```

If no LLM is configured, returns empty facets with a message:

```json
{
  "data": {
    "product": { "slug": "trading", "name": "Trading" },
    "facets": [],
    "message": "Knowledge synthesis requires an LLM provider. Set OPENAI_API_KEY or ANTHROPIC_API_KEY."
  }
}
```

### Regenerate Knowledge

```
POST /api/v1/knowledge/regenerate
```

Force a full regeneration of knowledge from all active decisions.

**Request body:**

```json
{
  "product": "trading",
  "feature": "margin-rework"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product` | string | Yes | Product slug |
| `feature` | string | No | Feature slug (omit for product-level) |

**Response (200):** Same format as GET.
```

---

## 4. `docs/cli.md` — CLI Reference

### 4a. Add `lock knowledge` command

Add a new section after `lock export`:

```markdown
---

### `lock knowledge` — View Synthesized Knowledge

Display synthesized product knowledge — summary, principles, tensions, and trajectory.

```bash
lock knowledge
lock knowledge --product trading
lock knowledge --product trading --feature margin-rework
lock knowledge --regenerate
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--product <slug>` | Product slug | config default |
| `--feature <slug>` | Feature slug | — |
| `--regenerate` | Force full regeneration from all decisions | false |

**Output:**

```
Knowledge — Trading / Margin Rework

  Summary
    The margin rework feature has evolved from a simple margin-based display
    to a notional value approach, with a recent pivot to user-togglable views...

  Principles
    - All position values must support both notional and margin display
    - Real-time prices for trading, end-of-day snapshots for reporting
    - Redis for all caching; no Memcached

  Tensions & Open Questions
    - Unresolved: whether portfolio-level aggregation uses real-time or EOD
    - The team is split on WebSocket vs SSE for streaming updates

  Trajectory
    Recent decisions show a move toward user-configurable display options
    and away from one-size-fits-all defaults.

  v3 | 47 decisions | Updated 2/21/2026
```
```

### 4b. Update `lock export` — add `--with-knowledge` flag

Add to the export options table:

```markdown
| `--with-knowledge` | Prepend synthesized knowledge sections | false |
```

And add example:

```bash
lock export --product trading --with-knowledge
```

### 4c. Add `--type` flag info to `lock commit`

Add to the commit options note or add to the options table (it's handled via the API's auto-inference, but can be passed as `decision_type` in the request body):

Note: Decision type is auto-inferred by LLM if not specified. It appears in log output and recaps.

---

## 5. `docs/mcp.md` — MCP Server Reference

### 5a. Add missing tools

The MCP docs only list 7 tools. The server actually registers **11 tools**. Add these 4 missing tools:

#### Add `lock_context` tool (after `lock_search_semantic`, before Write Tools)

```markdown
---

#### `lock_context`

Returns all active decisions for a product as formatted markdown text. Prepends synthesized knowledge (summary and principles) when available. Use this to understand the full decision landscape before building.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `product` | string | No | Product slug to filter by |
| `feature` | string | No | Feature slug to filter by |

**Returns:** Formatted markdown with:
- Knowledge preamble (summary + principles) if available
- Architectural constraints section
- Decisions grouped by feature, sorted by scope
- Footer reminder to check before contradicting decisions
```

#### Add `lock_check` tool (after `lock_context`)

```markdown
---

#### `lock_check`

Search for existing decisions relevant to what you are about to build. Use before starting work to check for constraints. Returns formatted markdown with blocking (architectural/major) and informational (minor) decisions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `intent` | string | Yes | What you are about to build or change |
| `product` | string | No | Product slug to scope the search |
| `feature` | string | No | Feature slug to scope the search |

**Returns:** Formatted markdown with blocking constraints and informational context.
```

#### Add `lock_recap` tool (after `lock_check`)

```markdown
---

#### `lock_recap`

Get a summary of recent decisions across the organization. Shows totals, breakdowns by scope and type, top contributors, and key decisions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `product` | string | No | Product slug to filter by (omit for org-wide) |
| `since` | string | No | ISO date — only include decisions after this date (default: 7 days ago) |

**Returns:** Formatted markdown recap with period, stats, contributors, and key decisions.
```

#### Add `lock_knowledge` tool (after `lock_recap`)

```markdown
---

#### `lock_knowledge`

Get synthesized knowledge about a product or feature — summary, principles, tensions, and trajectory derived from all recorded decisions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `product` | string | Yes | Product slug |
| `feature` | string | No | Feature slug (omit for product-level knowledge) |
| `regenerate` | boolean | No | Force full regeneration from all decisions (default: false) |

**Returns:** Formatted markdown with four knowledge facets (summary, principles, tensions, trajectory) and generation metadata.
```

### 5b. Update the "Why Give AI Agents Access" section

Add a bullet:

```markdown
- **Read synthesized knowledge** — understand the principles, tensions, and trajectory of a product area, not just individual decisions
```

### 5c. Add Usage Pattern for Knowledge

Add to the "Usage Patterns" section:

```markdown
### Understanding a Product Area

```
"Before working on the caching layer, read Lock's knowledge synthesis
for the trading product to understand the principles and constraints."
```

The agent will use `lock_knowledge` to get a synthesized understanding of the product — summary, principles, tensions, and trajectory — rather than parsing through individual decisions.
```

---

## 6. `docs/slack.md` — Slack Bot Reference

### 6a. Add `@lock knowledge` command

Add a new section after `@lock describe`:

```markdown
---

### `@lock knowledge` — View Synthesized Knowledge

Display synthesized product knowledge for a product or feature.

```
@lock knowledge --product trading
@lock knowledge --product trading --feature margin-rework
@lock knowledge
```

If no `--product` flag is provided, Lock uses the channel's configured product (from `@lock init`).

**Flags:**

| Flag | Description |
|------|-------------|
| `--product <slug>` | Product slug |
| `--feature <slug>` | Feature slug |

**Output:** Four sections — Summary, Principles, Tensions & Open Questions, and Trajectory — synthesized from all active decisions. Includes version number, decision count, and last update date.
```

### 6b. Add `@lock digest` command

This command exists in the codebase but is missing from docs. Add:

```markdown
---

### `@lock digest` — Configure Automated Digests

Set up automated decision digests for a channel.

```
@lock digest --schedule daily --hour 9
@lock digest --schedule weekly --hour 9 --days monday
@lock digest off
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--schedule <daily\|weekly>` | Digest frequency |
| `--hour <0-23>` | Hour to send (UTC) |
| `--days <day>` | Day of week for weekly digests |
```

### 6c. Add `@lock import` command

This command exists but is missing from docs. Add:

```markdown
---

### `@lock import` — Import Decisions from Channel History

Scan recent channel messages for decisions and offer to commit them.

```
@lock import
@lock import --since 7d
```

Lock uses an LLM to scan recent messages, extract potential decisions, and presents them as candidates with Commit/Skip buttons for each.

**Flags:**

| Flag | Description |
|------|-------------|
| `--since <duration>` | How far back to scan (e.g., `7d`, `30d`) |
```

---

## 7. `docs/self-hosting.md` — Self-Hosting Guide

### 7a. Update schema table

Add the `knowledge` table to the "Schema" section's table:

```markdown
| `knowledge` | Synthesized product/feature knowledge (4 facets per scope) |
```

So the table becomes 8 tables, not 7.

### 7b. Update Degraded Modes

Update the "Without OpenAI" bullet:

```markdown
- **Without OpenAI**: Semantic search falls back to text search (ILIKE). Conflict detection is disabled. Knowledge synthesis is unavailable.
```

Update the "Without Anthropic" bullet:

```markdown
- **Without Anthropic**: Conflict classification is disabled. Knowledge synthesis is unavailable. Similar decisions are still found via embeddings, but relationships aren't classified.
```

### 7c. Update Architecture diagram

Add knowledge to the Core API box:

```
│  - Decision CRUD       │
│  - Conflict detection   │
│  - Knowledge synthesis  │
│  - Lineage tracking    │
│  - Notifications       │
```

---

## Summary of all gaps

| Gap | Files affected |
|-----|---------------|
| Knowledge system (entirely new) | All 7 docs files |
| Decision types (`product`, `technical`, etc.) | concepts.md, api.md, cli.md |
| `lock_context` MCP tool (missing) | mcp.md |
| `lock_check` MCP tool (missing) | mcp.md |
| `lock_recap` MCP tool (missing) | mcp.md |
| `lock_knowledge` MCP tool (new) | mcp.md |
| `GET /api/v1/locks/recap` endpoint | api.md |
| `POST /api/v1/locks/pre-check` endpoint | api.md |
| `POST /api/v1/locks/extract-batch` endpoint | api.md |
| `GET /api/v1/knowledge` endpoints | api.md |
| `lock knowledge` CLI command (new) | cli.md |
| `--with-knowledge` export flag (new) | cli.md |
| `@lock knowledge` Slack command (new) | slack.md |
| `@lock digest` Slack command (missing) | slack.md |
| `@lock import` Slack command (missing) | slack.md |
| `knowledge` DB table (new) | self-hosting.md |
