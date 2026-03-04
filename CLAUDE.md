# CLAUDE.md — Lock: The Decision Protocol for Product Teams

## What is this project?

Lock is a decision-tracking tool that captures product decisions where they happen — in Slack, in the terminal, or in AI agent sessions. Think "git commit" but for product decisions instead of code.

The core problem: product teams make decisions in Slack threads ("let's use notional value instead of margin here") that get implemented but never formally recorded. Three months later, nobody knows why something was built a certain way.

Lock solves this with a simple `@lock` command that snapshots a decision with full context.

---

## ⚠️ Repo Structure: Open-Source Core + Private SaaS

**This is a private monorepo.** It contains both the open-source project and the hosted SaaS layer. The public open-source repo lives at [github.com/uselock/lock](https://github.com/uselock/lock). A sync script copies only the open-source parts there.

### The boundary

| Package | Visibility | Purpose |
|---------|-----------|---------|
| `packages/core/` | **Public** (open-source) | Core API engine, all decision logic |
| `packages/cli/` | **Public** (minus `signup.ts`, `device-flow.ts`) | CLI client |
| `packages/mcp/` | **Public** | MCP server for AI agents |
| `packages/slack/` | **Public** | Slack bot surface |
| `packages/saas/` | **Private** | Auth, billing, user management, usage limits |
| `packages/web/` | **Private** | Next.js web dashboard |
| `.github/` | **Private** | CI/CD workflows |

### Rules — READ BEFORE MAKING CHANGES

1. **Core must NEVER import from SaaS.** No imports of `@uselock/saas`, no relative imports reaching into `packages/saas/`. The dependency flows one way: `saas → core`, never `core → saas`.

2. **SaaS extends core via hooks and plugins, not by editing core.** Core exposes:
   - `buildApp(options)` — Fastify factory that SaaS extends with plugins, routes, CORS
   - `registerAuthStrategy(fn)` — SaaS registers session/JWT auth
   - `onBeforeCommit(fn)` / `onAfterCommit(fn)` — SaaS registers usage limit checks
   - If you need core to do something new for SaaS, add a hook or extension point — don't add SaaS logic directly.

3. **These dependencies belong in `packages/saas/`, NOT core:** `bcryptjs`, `jose`, `stripe`, `@fastify/cookie`. If you find yourself adding auth, billing, or user management deps to core, stop — it goes in saas.

4. **These DB tables are SaaS-only** (defined in `packages/saas/src/db/schema.ts`): `users`, `sessions`, `workspaceMembers`, `workspaceInvites`, `subscriptions`. Don't add them to `packages/core/src/db/schema.ts`.

5. **CLI has conditional SaaS features.** `signup.ts` and `device-flow.ts` are loaded via dynamic `import()` with try/catch. In the open-source build, they're simply absent and the CLI gracefully falls back to API-key-only auth.

6. **Don't put secrets or SaaS-specific env vars in open-source config files.** Check `.env.example` and `docker-compose.yml` — only include what self-hosters need.

### Syncing to public repo

```bash
bash scripts/sync-public.sh /path/to/lock-public
```

The script uses rsync to copy open-source files, excludes private packages, and verifies no SaaS imports leaked into core. Run it before pushing to the public repo.

---

## Architecture Overview

Lock is a **multi-surface protocol** with one core engine and multiple input/output surfaces:

```
INPUT SURFACES              CORE                 OUTPUT SURFACES
┌──────────────┐
│  Slack Bot   │──┐
└──────────────┘  │
┌──────────────┐  │  ┌────────────────┐    ┌─────────────────┐
│  CLI         │──┼──│  Core Engine   │────│ Slack Notify    │
└──────────────┘  │  │  (Fastify API) │    └─────────────────┘
┌──────────────┐  │  │                │    ┌─────────────────┐
│  MCP Server  │──┼──│  - decisions   │────│ Admin UI        │
│  (agents)    │  │  │  - conflicts   │    └─────────────────┘
└──────────────┘  │  │  - lineage     │
┌──────────────┐  │  │  - extraction  │
│  REST API    │──┘  └───────┬────────┘
└──────────────┘             │
                    ┌────────┴────────┐
                    │   PostgreSQL    │
                    │   + pgvector    │
                    └─────────────────┘
```

### Tech Stack

| Component     | Technology                  | Notes                                          |
|---------------|-----------------------------|-------------------------------------------------|
| Core API      | Node.js + Fastify 5         | Central REST API, all business logic lives here |
| Slack Bot     | @slack/bolt 4               | Slack event handling via socket mode             |
| CLI           | Node.js (commander.js 12)   | Thin client calling the REST API                |
| MCP Server    | @modelcontextprotocol/sdk   | Exposes Lock tools for AI agents (stdio transport) |
| Database      | PostgreSQL 16 + pgvector    | Decisions + vector embeddings                   |
| ORM           | Drizzle ORM                 | Type-safe, lightweight. Schema push via drizzle-kit |
| Embeddings    | OpenAI text-embedding-3-small | For conflict detection + semantic search       |
| LLM           | OpenAI gpt-4o-mini          | Conflict classification, decision extraction, polish |
| Runtime       | Node.js 20+                | ESM modules throughout                          |
| Package mgr   | pnpm 9+                    | Workspace monorepo                              |
| Testing       | Vitest                      | Unit + e2e tests                                |

---

## Project Structure

This is a **pnpm monorepo** with the following packages:

```
lock/
├── CLAUDE.md                          # This file
├── pnpm-workspace.yaml
├── package.json                       # Root package.json (scripts, shared deps)
├── tsconfig.base.json                 # Shared TS config (ES2022, ESNext, strict)
├── vitest.config.ts                   # Test config (packages/*/src/**/*.test.ts)
├── .env.example                       # Environment variables template
├── docker-compose.yml                 # PostgreSQL + pgvector + Lock app
├── Dockerfile                         # Multi-stage build (core + slack only)
├── slack-app-manifest.yml             # Slack app manifest for easy setup
│
├── packages/
│   ├── core/                          # Core engine — business logic + API
│   │   ├── package.json               # @uselock/core
│   │   ├── drizzle.config.ts          # Drizzle Kit config
│   │   └── src/
│   │       ├── index.ts               # Fastify server entry point
│   │       ├── types.ts               # Shared TypeScript types
│   │       ├── db/
│   │       │   ├── schema.ts          # Drizzle schema (all tables + pgvector custom type)
│   │       │   ├── migrate.ts         # Migration runner
│   │       │   └── client.ts          # DB connection (pg pool + drizzle)
│   │       ├── routes/
│   │       │   ├── locks.ts           # CRUD + commit + extract + revert + search + lineage
│   │       │   ├── products.ts        # Product CRUD + list (with lock_count)
│   │       │   ├── features.ts        # Feature CRUD + list
│   │       │   ├── channel-configs.ts # Map Slack channels to product+feature
│   │       │   ├── health.ts          # GET /health (no auth)
│   │       │   └── ui.ts             # Admin UI for API key management (no auth)
│   │       ├── services/
│   │       │   ├── lock-service.ts    # Core decision logic (commit, list, revert, search, update)
│   │       │   ├── conflict-service.ts # Embedding + pgvector search + LLM classification
│   │       │   ├── extract-service.ts # LLM decision extraction from thread context
│   │       │   ├── lineage-service.ts # Supersession + revert chain traversal
│   │       │   └── notify-service.ts  # Cross-surface Slack notifications
│   │       └── lib/
│   │           ├── embeddings.ts      # OpenAI text-embedding-3-small generation
│   │           ├── llm.ts            # OpenAI gpt-4o-mini (extraction + classification)
│   │           ├── id.ts             # Short ID generation (l-xxxxxx)
│   │           └── auth.ts           # API key + internal secret auth middleware
│   │
│   ├── slack/                         # Slack bot surface
│   │   ├── package.json               # @uselock/slack
│   │   └── src/
│   │       ├── index.ts               # Bolt app entry point (socket mode)
│   │       ├── types.ts               # ParsedCommand, ThreadContext interfaces
│   │       ├── commands/
│   │       │   ├── lock.ts            # @lock <message> — 3 modes: explicit/extract/polish
│   │       │   ├── init.ts            # @lock init --product <p> --feature <f>
│   │       │   ├── log.ts             # @lock log (with filters)
│   │       │   ├── products.ts        # @lock products
│   │       │   ├── features.ts        # @lock features
│   │       │   ├── revert.ts          # @lock revert <id> "reason"
│   │       │   ├── link.ts            # @lock link <id> <ref>
│   │       │   ├── search.ts          # @lock search "query"
│   │       │   └── recap.ts           # @lock recap --product <p>
│   │       ├── actions/
│   │       │   ├── confirm-commit.ts  # Confirm extracted decision → commit
│   │       │   ├── edit-decision.ts   # Edit extracted decision in modal → commit
│   │       │   ├── cancel-extract.ts  # Cancel extraction
│   │       │   ├── change-scope.ts    # Change scope via dropdown post-commit
│   │       │   ├── add-link.ts        # Add Jira/Figma link via modal post-commit
│   │       │   └── add-tags.ts        # Add tags via modal post-commit
│   │       └── lib/
│   │           ├── parser.ts          # Parse @lock commands + flags + detect mode
│   │           ├── thread-context.ts  # Extract thread context from Slack API
│   │           └── formatters.ts      # Format responses as Slack Block Kit blocks
│   │
│   ├── cli/                           # CLI surface
│   │   ├── package.json               # @uselock/cli (bin: "lock")
│   │   └── src/
│   │       ├── index.ts               # CLI entry point — "lock <msg>" shorthand for "lock commit <msg>"
│   │       ├── types.ts               # Credentials, ProjectConfig interfaces
│   │       ├── commands/
│   │       │   ├── commit.ts          # lock "message" (--scope, --tag, --ticket)
│   │       │   ├── init.ts            # lock init (interactive or --product --feature)
│   │       │   ├── log.ts             # lock log (--product, --feature, --scope, --status, --limit)
│   │       │   ├── show.ts            # lock show <id>
│   │       │   ├── search.ts          # lock search "query"
│   │       │   ├── check.ts           # lock check "intent" — pre-build constraint check
│   │       │   ├── revert.ts          # lock revert <id> "reason"
│   │       │   ├── link.ts            # lock link <id> <ref> (auto-detects link type)
│   │       │   ├── export.ts          # lock export — generates LOCK.md markdown
│   │       │   ├── products.ts        # lock products
│   │       │   ├── features.ts        # lock features
│   │       │   ├── login.ts           # lock login (--url, --key or interactive)
│   │       │   ├── logout.ts          # lock logout (--force)
│   │       │   └── whoami.ts          # lock whoami — shows auth status + connectivity
│   │       └── lib/
│   │           ├── config.ts          # Read/write .lock/config.json (project scope)
│   │           ├── api-client.ts      # HTTP client for core API (apiGet, apiPost, apiPatch)
│   │           ├── credentials.ts     # Read/write ~/.lock/credentials (0600 perms)
│   │           └── formatters.ts      # Terminal output formatting (chalk)
│   │
│   └── mcp/                           # MCP server surface (for AI agents)
│       ├── package.json               # @uselock/mcp (bin: "lock-mcp")
│       └── src/
│           ├── index.ts               # MCP server entry point (stdio transport)
│           ├── tools/
│           │   ├── list-products.ts   # lock_list_products
│           │   ├── list-features.ts   # lock_list_features
│           │   ├── query.ts           # lock_query (filter by product/feature/scope/status/tags)
│           │   ├── get.ts             # lock_get (by short ID or UUID)
│           │   ├── get-lineage.ts     # lock_get_lineage (supersession/revert chain)
│           │   ├── search-semantic.ts # lock_search_semantic (vector search, returns JSON)
│           │   ├── commit.ts          # lock_commit (author: MCP Agent)
│           │   ├── context.ts         # lock_context (all active decisions as markdown)
│           │   └── check.ts           # lock_check (pre-build constraint check, markdown)
│           └── lib/
│               ├── api-client.ts      # HTTP client (apiGet, apiPost)
│               └── types.ts           # Shared type interfaces
│
├── scripts/
│   ├── docker-entrypoint.sh           # Waits for PG, runs drizzle-kit push, starts core + slack
│   └── init-db.sql                    # Enables vector + pgcrypto extensions
│
└── docs/                              # Documentation
    ├── index.md                       # Documentation home / overview
    ├── concepts.md                    # Core concepts (locks, scopes, statuses, conflict detection)
    ├── api.md                         # REST API reference
    ├── slack.md                       # Slack bot reference (3 modes, all commands)
    ├── cli.md                         # CLI reference (all commands)
    ├── mcp.md                         # MCP server reference (all tools)
    ├── self-hosting.md                # Docker + manual deployment guide
    └── website-brief.md               # Marketing website content brief
```

---

## Database Schema

Drizzle ORM with PostgreSQL. Schema in `packages/core/src/db/schema.ts`. Uses a custom `vector(1536)` type for pgvector.

### Tables

- **workspaces** — Tenants. Fields: `id` UUID, `slackTeamId` TEXT unique (null for CLI-only), `name`, `createdAt`
- **products** — Top-level org unit. Fields: `id`, `workspaceId` FK, `slug` TEXT (unique per workspace), `name`, `description`, `createdAt`
- **features** — Scoped area within a product. Fields: `id`, `productId` FK, `slug` (unique per product), `name`, `description`, `slackChannelId`, `createdAt`
- **locks** — The core decisions table. Fields: `id`, `shortId` TEXT unique, `workspaceId`/`productId`/`featureId` FKs, `message`, author fields (`authorType`, `authorId`, `authorName`, `authorSource`), classification (`scope`, `status`, `tags`), source context (`sourceType`, `sourceRef`, `sourceContext`, `participants`), lineage (`supersedesId`, `supersededById`, `revertedById` self-referential FKs), `embedding` vector(1536), `createdAt`
- **lockLinks** — External links. Fields: `id`, `lockId` FK, `linkType` (jira/figma/github/linear/notion/other), `linkRef`, `createdAt`
- **channelConfigs** — Maps Slack channels to product+feature. Fields: `id`, `workspaceId`, `slackChannelId` unique, `productId`, `featureId`, `createdAt`
- **apiKeys** — API authentication. Fields: `id`, `workspaceId`, `keyHash` (SHA-256), `keyPrefix` (first 8 chars), `name`, `scopes` (default: read,write), `createdAt`, `lastUsedAt`

### Indexes
workspace, product, feature, status, shortId on locks table.

---

## Core API Endpoints

All endpoints under `/api/v1/` require auth via `Authorization: Bearer <api_key>` or internal auth (`X-Internal-Secret` + `X-Workspace-Team-Id` headers). Unauthenticated routes: `GET /health`, `GET /` (admin UI), `/_ui/*` endpoints.

### Locks

```
POST   /api/v1/locks                    # Commit a new decision
GET    /api/v1/locks                    # List/filter (query: product, feature, scope, status, author, tags, limit, offset)
POST   /api/v1/locks/extract            # LLM extraction from thread context (body: { thread_context, user_hint?, product?, feature? })
POST   /api/v1/locks/search             # Semantic search (body: { query, product?, feature? })
GET    /api/v1/locks/:shortId           # Get single lock with full detail
PATCH  /api/v1/locks/:shortId           # Update scope and/or tags (only mutable fields)
GET    /api/v1/locks/:shortId/lineage   # Get supersession/revert chain
POST   /api/v1/locks/:shortId/revert    # Revert a lock (body: { message, author })
POST   /api/v1/locks/:shortId/link      # Add external link (body: { link_type, link_ref })
```

**Note:** Route registration order matters — `/extract` and `/search` must be registered before `/:shortId` to avoid route conflicts.

### Products, Features, Channel Configs

```
GET/POST         /api/v1/products              # List (with lock_count) / Create
PATCH            /api/v1/products/:slug         # Update name/description
GET/POST         /api/v1/features              # List (filter: ?product=slug) / Create
PATCH            /api/v1/features/:slug         # Update name/description
POST             /api/v1/channel-configs        # Map channel to product+feature (upserts)
GET              /api/v1/channel-configs/:channelId  # Get channel config
```

### Admin UI (no auth)

```
GET    /                               # Self-contained dark-themed HTML page for API key management
GET    /_ui/workspaces                 # List all workspaces
GET    /_ui/keys                       # List API keys (prefix only, no secrets)
POST   /_ui/keys                       # Create API key (returns raw key once)
```

### Response Format

Success: `{ data: { ... } }` — Error: `{ error: { code: "LOCK_NOT_FOUND", message: "..." } }`

---

## Authentication

Two auth paths in `packages/core/src/lib/auth.ts`:

1. **Bearer token**: `Authorization: Bearer lk_...` — hashes key with SHA-256, looks up in `api_keys` table, sets `request.workspaceId`. Updates `last_used_at`.
2. **Internal service auth**: `X-Internal-Secret` header matches `INTERNAL_SECRET` env var — resolves workspace from `X-Workspace-Team-Id` (upserts workspace if needed). Used by Slack bot.

---

## Conflict Detection Pipeline

Runs on every `commitLock()` call in `conflict-service.ts`:

1. **Generate embedding** — OpenAI text-embedding-3-small. Returns early if no `OPENAI_API_KEY`.
2. **Save embedding** — Raw SQL update: `UPDATE locks SET embedding = ...::vector WHERE id = ...`
3. **pgvector similarity search** — Top 5 most similar **active** locks in the same **product** (cross-feature), using `<=>` cosine distance. Threshold: similarity > 0.75.
4. **LLM classification** — For each candidate above threshold, call `classifyRelationship()` (OpenAI gpt-4o-mini, JSON mode) in parallel via `Promise.all`. Classifies as: `no_relation`, `related`, `potential_conflict`, or `supersession`.
5. **Apply supersession** — If detected, old lock is set to `status='superseded'` with bidirectional linking.

**Graceful degradation:** Without `OPENAI_API_KEY`, conflict detection is skipped entirely. Semantic search falls back to ILIKE text matching.

---

## Decision Extraction (LLM)

`packages/core/src/lib/llm.ts` uses **OpenAI gpt-4o-mini** (not Claude) for two functions:

1. **`extractDecision(threadContext, userHint?, product?, feature?)`** — Two modes:
   - **Extract mode** (no hint): Finds the key decision in a thread conversation
   - **Polish mode** (with hint): Cleans up a user-provided statement into a clear decision
   - Returns: `{ decision, scope, tags, confidence, reasoning }`

2. **`classifyRelationship(existingLock, newLock)`** — Classifies relationship between two decisions
   - Returns: `{ relationship, explanation }`

Both use `response_format: { type: 'json_object' }` for structured output.

---

## Slack Bot

### Three Commit Modes

The Slack bot supports three ways to record a decision:

1. **Explicit** (`@lock <message>`) — User writes the decision directly. Committed immediately.
2. **Extract** (`@lock this` / `@lock that` / `@lock it` / bare `@lock` in thread) — LLM reads the thread, extracts a decision, shows preview with confidence score. User confirms/edits/cancels via interactive buttons.
3. **Polish** (`@lock the fact that...` / `@lock the decision that...`) — User gives the gist, LLM reads thread context and produces a clean statement. Auto-commits.

Mode detection happens in `parser.ts` via `detectMode()`.

### Command Patterns

```
@lock <message>                                    → explicit commit
@lock <message> --scope major --ticket TRADE-442   → commit with flags
@lock this / @lock that / @lock it / @lock         → extract from thread (requires thread)
@lock the fact that <message>                      → polish mode
@lock init --product <p> --feature <f>             → initialize channel
@lock log [--product <p>] [--feature <f>] [--scope] → show recent locks (default: 10)
@lock recap [--product <p>]                        → grouped summary of all active decisions
@lock search "query" [--product] [--feature]       → semantic search
@lock products                                     → list products
@lock features [--product <p>]                     → list features
@lock revert <short_id> "reason"                   → revert a lock
@lock link <short_id> <ref>                        → add link (auto-detects type)
@lock describe --product <p> "description"         → update product description
@lock describe --feature <f> "description"         → update feature description
```

### Post-Commit Enrichment

Every committed lock message includes an actions bar with: scope dropdown, Add Jira button, Add Figma button, Add Tags button. These open Slack modals for inline annotation.

### Interactive Actions

All registered in `packages/slack/src/actions/`:
- `confirm_commit` — Commit an extracted decision
- `edit_decision` — Opens modal to edit decision text, scope, tags, ticket before committing
- `cancel_extract` — Cancel extraction
- `change_scope` — Update scope via dropdown (PATCH endpoint)
- `add_link_jira` / `add_link_figma` — Opens modal to add link
- `add_tags` — Opens modal to add comma-separated tags

---

## CLI

### Authentication Commands

- `lock login [--url <url>] [--key <key>]` — Interactive or flag-based. Validates against server before saving. Credentials stored in `~/.lock/credentials` with `0600` permissions.
- `lock logout [--force]` — Remove stored credentials (prompts for confirmation).
- `lock whoami` — Shows API URL, key prefix, and server connectivity status.
- Auto-prompt: Any command without credentials triggers interactive credential flow.

### Project Commands

- `lock init [--product <slug>] [--feature <slug>]` — Creates `.lock/config.json`. **Interactive mode** (no flags): fetches products/features from API, presents selection lists with `@inquirer/prompts`, includes "Create new" option.
- `lock "message"` — Shorthand for `lock commit "message"`. Reads `.lock/config.json` for product/feature scope.
- `lock commit <message> [--scope] [--tag...] [--ticket]` — Commit a decision.
- `lock check <intent> [--product] [--feature]` — Pre-build constraint check. Semantic search for relevant existing decisions.
- `lock log [--product] [--feature] [--scope] [--status] [--limit]` — List locks (default: 20).
- `lock show <id>` — Full lock detail.
- `lock search <query> [--product] [--feature]` — Semantic search.
- `lock revert <id> [reason] [-m message]` — Revert a lock (reason via positional arg or `-m` flag).
- `lock link <id> <ref>` — Add link. Auto-detects type: Jira (PROJ-123 pattern), GitHub, Figma, Linear, Notion, or other.
- `lock export [--product] [--feature] [--scope] [--output LOCK.md]` — Export active decisions to markdown. Groups by feature, sorts by scope (architectural first).
- `lock products` / `lock features [--product]` — List products/features.

---

## MCP Server Tools

9 tools exposed via stdio transport. The MCP server is a thin wrapper calling the Core API.

### Read Tools (returning JSON)

```
lock_list_products()                    → { products: [...] }
lock_list_features({ product? })        → { features: [...] }
lock_query({ product?, feature?,        → { locks: [...] }
             tags?, scope?, status?,
             limit? })
lock_get({ lock_id })                   → { lock: {...} }
lock_get_lineage({ lock_id })           → { chain: [...] }
lock_search_semantic({ query,           → { locks: [...] }
                       product?,
                       feature? })
```

### Read Tools (returning formatted Markdown — for agent UX)

```
lock_context({ product?, feature? })    → Markdown: all active decisions grouped by feature, sorted by scope
lock_check({ intent, product?,          → Markdown: relevant decisions + guidance for the agent
             feature? })
```

### Write Tools

```
lock_commit({ message, product?,        → { lock: {...}, conflicts: [...], supersession? }
              feature?, scope?,
              tags?, source? })
```

`lock_commit` always authors as `{ type: 'agent', id: 'mcp-agent', name: 'MCP Agent', source: 'mcp' }`.

### MCP server config (Claude Code / Cursor)

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

---

## Cross-Surface Notifications

When a lock is committed from CLI or MCP (not Slack), `notify-service.ts` posts to the relevant Slack channel if one is configured for that feature. Uses `@slack/web-api` with `SLACK_BOT_TOKEN`. Errors are silently swallowed (non-blocking).

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://lock:lock@localhost:5432/lock

# OpenAI (embeddings + LLM classification/extraction)
OPENAI_API_KEY=sk-...

# Anthropic (unused in current implementation, reserved for future use)
ANTHROPIC_API_KEY=sk-ant-...

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...          # For socket mode

# App
API_PORT=3000
SLACK_PORT=3001
NODE_ENV=development
INTERNAL_SECRET=change-me          # Shared secret for Slack bot → Core API auth
```

**Graceful degradation:**
- Without `OPENAI_API_KEY`: No embeddings, no conflict detection, semantic search falls back to ILIKE
- Without Slack tokens: CLI and MCP still work, no cross-surface notifications
- Without `INTERNAL_SECRET`: Slack bot can't authenticate to core API

---

## Deployment

### Docker (recommended)

`docker-compose.yml` defines two services:
- **postgres**: `pgvector/pgvector:pg16` with `init-db.sql` enabling vector + pgcrypto extensions
- **lock**: Multi-stage Dockerfile builds core + slack only (CLI and MCP excluded). `docker-entrypoint.sh` waits for PG health, runs `drizzle-kit push --force`, then starts both core API and Slack bot as background processes.

```bash
cp .env.example .env  # Fill in keys
docker compose up -d
# Admin UI at http://localhost:3000 — create workspace + API key
```

### Development

```bash
pnpm install
pnpm db:up              # Start PostgreSQL via Docker
pnpm db:migrate         # Run Drizzle migrations
pnpm build              # Build all packages
pnpm dev                # Start core + slack (concurrently)
pnpm dev:core           # Core API only
pnpm dev:slack          # Slack bot only
pnpm dev:cli            # CLI in dev mode (tsx)
pnpm dev:mcp            # MCP server in dev mode (tsx)
```

---

## Testing

Uses Vitest. Config in `vitest.config.ts` — discovers `packages/*/src/**/*.test.ts`.

```bash
pnpm test               # All tests
pnpm test:unit          # Unit tests only (excludes e2e/)
pnpm test:e2e           # E2e tests (requires DATABASE_URL)
```

### Test Files

- `packages/core/src/lib/id.test.ts` — Short ID generation (prefix, length, hex format, uniqueness)
- `packages/core/src/e2e/api.test.ts` — Full API e2e suite (skipped without DB). Tests: health, auth, products CRUD, features CRUD, lock commit/list/get/update/revert/link, channel configs. Uses `setup.ts` for test app bootstrap + seed data + cleanup.
- `packages/cli/src/lib/formatters.test.ts` — Terminal formatting (lock list, lock detail, conflicts, supersession)
- `packages/slack/src/lib/parser.test.ts` — Command parsing (subcommands, flags, modes, quoted strings, positional args)
- `packages/slack/src/lib/formatters.test.ts` — Block Kit formatting (all formatters)

---

## Code Style & Conventions

- **Language**: TypeScript (strict mode) throughout
- **Modules**: ESM (`"type": "module"` in all package.json files)
- **Error handling**: Structured errors: `{ error: { code: "LOCK_NOT_FOUND", message: "..." } }`
- **Naming**: camelCase for variables/functions, PascalCase for types, kebab-case for files
- **Database**: Parameterized queries. Raw SQL via `db.execute(sql`...`)` only for pgvector operations.
- **API responses**: `{ data: ... }` for success, `{ error: ... }` for errors
- **Logging**: Fastify's built-in pino logger (debug in dev, info in prod)

---

## Important Design Decisions

1. **Product/Feature are auto-created**: `upsertProduct`/`upsertFeature` in `lock-service.ts`. Slugs auto-generate Title Case display names.

2. **Locks are immutable**: Message can never be edited. Only `scope` and `tags` are mutable (via PATCH). Revert creates a new lock; supersession creates a new lock.

3. **Conflict detection is cross-feature but within-product**: Decisions in `margin-rework` are checked against `ui` and `risk-engine` if they're all under `trading`.

4. **Slack is the awareness layer**: Even CLI/MCP decisions are surfaced in Slack via `notify-service.ts`.

5. **CLI and MCP are thin clients**: All business logic lives in core. They just call the REST API.

6. **Short IDs are for humans, UUIDs are for the database**: `l-` + 6 hex chars. Generated in `id.ts` with collision retry (max 3 attempts).

7. **Admin UI is unauthenticated**: The `/_ui/*` routes and root HTML page have no auth gate — API key creation is open to anyone who can reach the server.

8. **Slack bot uses internal auth**: Not Bearer tokens — uses `X-Internal-Secret` + `X-Workspace-Team-Id` headers for service-to-service auth.

9. **LLM calls use OpenAI gpt-4o-mini**: Both extraction and classification. Returns early / degrades gracefully if API key is missing.

10. **Embedding writes bypass Drizzle ORM**: Raw SQL for pgvector operations due to custom type complexity.
