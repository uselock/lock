# Lock — The Decision Protocol for Product Teams

Lock captures product decisions where they happen — in Slack, in the terminal, or in AI agent sessions. Think **git commit, but for product decisions** instead of code.

## The Problem

Product teams make decisions in Slack threads, standups, and design reviews every day. "Let's use notional value instead of margin here." "We'll go with WebSockets, not polling." These decisions get implemented — but never formally recorded.

Three months later, a new engineer joins and asks: _Why was it built this way?_ Nobody remembers. The Slack thread is buried. The context is gone.

## How Lock Works

Lock gives your team a single command to snapshot a decision with full context:

```
@lock Use notional value instead of margin for position display --scope major
```

That's it. Lock records **who** decided, **when**, **why**, and **what was discussed** — then checks it against every other active decision in your product for conflicts.

## Three Surfaces, One Protocol

Lock meets your team where they already work:

| Surface | Best For | Example |
|---------|----------|---------|
| [**Slack Bot**](/docs/slack) | Team decisions in real-time | `@lock this` in a thread, or `@lock Use margin-based risk calculations --scope major` |
| [**CLI**](/docs/cli) | Developer workflow integration | `lock commit "Migrate to PostgreSQL 16" --scope architectural` |
| [**MCP Server**](/docs/mcp) | AI agent awareness | Claude/Cursor reads decisions before writing code |

All three surfaces feed into the same decision log. A decision made in Slack is visible in the CLI and to AI agents — instantly.

## Core Concepts

- **Locks** are immutable decision records. Once committed, a lock can't be edited — only reverted or superseded by a new decision.
- **Products** are top-level containers (e.g., "Trading", "Risk Engine").
- **Features** are scoped areas within a product (e.g., "Margin Rework", "Position Display").
- **Scopes** indicate impact: `minor`, `major`, or `architectural`.
- **Conflict detection** uses semantic search to automatically find contradicting decisions across features within the same product.

Learn more in [Core Concepts](/docs/concepts).

## Quick Start

### Option 1: Slack (for teams)

1. Install the Lock Slack app in your workspace
2. In any channel: `@lock init --product my-product --feature my-feature`
3. Start recording decisions:
   - Write it yourself: `@lock We'll use REST instead of GraphQL --scope major`
   - Or let Lock extract it from a thread: `@lock this`

### Option 2: CLI (for developers)

```bash
# Install
npm install -g @uselock/cli

# Authenticate
lock init --product my-product --feature my-feature

# Record a decision
lock "Cache user sessions in Redis" --scope major --tag performance
```

### Option 3: MCP (for AI agents)

Add Lock to your Claude Code or Cursor config:

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

Your AI agent will automatically check existing decisions before writing code.

## What Happens When You Lock a Decision

```
You: @lock Use notional value instead of margin for position display --scope major

Lock:
  1. Records the decision with full context (who, when, thread discussion)
  2. Generates a semantic embedding of the decision
  3. Searches for similar active decisions across the product
  4. Classifies relationships: conflict, supersession, or unrelated
  5. Returns the result with any detected conflicts

Response:
  Lock committed (l-a7f3e2) [major]
  "Use notional value instead of margin for position display"

  Supersedes l-x9y2z3: "Use margin for position display"
  The new decision directly replaces the approach in l-x9y2z3.

  Potential conflict with l-b8c4f1: "Display all values in margin terms"
  These decisions contradict each other on what metric to display.
```

## Documentation

- [Core Concepts](/docs/concepts) — Products, features, scopes, lineage, and conflict detection
- [Slack Bot](/docs/slack) — Complete Slack command reference
- [CLI](/docs/cli) — Terminal command reference and configuration
- [MCP Server](/docs/mcp) — AI agent integration guide
- [REST API](/docs/api) — Full API reference for building integrations
- [Self-Hosting](/docs/self-hosting) — Deploy Lock on your own infrastructure
