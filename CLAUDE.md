# CLAUDE.md — Lock: The Decision Protocol for Product Teams

## What is this project?

Lock is a decision-tracking tool that captures product decisions where they happen — in Slack, in the terminal, or in AI agent sessions. Think "git commit" but for product decisions instead of code.

The core problem: product teams make decisions in Slack threads ("let's use notional value instead of margin here") that get implemented but never formally recorded. Three months later, nobody knows why something was built a certain way.

Lock solves this with a simple `@lock` command that snapshots a decision with full context.

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
│  MCP Server  │──┼──│  - decisions   │────│ Jira Sync       │
│  (agents)    │  │  │  - conflicts   │    └─────────────────┘
└──────────────┘  │  │  - lineage     │    ┌─────────────────┐
┌──────────────┐  │  │  - policies    │────│ Webhooks        │
│  REST API    │──┘  └───────┬────────┘    └─────────────────┘
└──────────────┘             │
                    ┌────────┴────────┐
                    │   PostgreSQL    │
                    │   + pgvector    │
                    └─────────────────┘
```

### Tech Stack

| Component     | Technology                  | Notes                                          |
|---------------|-----------------------------|-------------------------------------------------|
| Core API      | Node.js + Fastify           | Central REST API, all business logic lives here |
| Slack Bot     | @slack/bolt                 | Slack event handling, slash commands             |
| CLI           | Node.js (commander.js)      | Thin client calling the REST API                |
| MCP Server    | @modelcontextprotocol/sdk   | Exposes Lock tools for AI agents                |
| Database      | PostgreSQL + pgvector       | Decisions + vector embeddings                   |
| ORM           | Drizzle ORM                 | Type-safe, lightweight                          |
| Embeddings    | OpenAI text-embedding-3-small | For conflict detection                        |
| LLM           | Claude API (claude-sonnet-4-5-20250929) | Conflict classification, supersession inference |
| Runtime       | Node.js 20+                | ESM modules throughout                          |
| Package mgr   | pnpm                       | Workspace monorepo                              |

---

## Project Structure

This is a **pnpm monorepo** with the following packages:

```
lock/
├── CLAUDE.md                          # This file
├── pnpm-workspace.yaml
├── package.json                       # Root package.json (scripts, shared deps)
├── .env.example                       # Environment variables template
├── docker-compose.yml                 # PostgreSQL + pgvector for local dev
│
├── packages/
│   ├── core/                          # Core engine — business logic + API
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts               # Fastify server entry point
│   │   │   ├── db/
│   │   │   │   ├── schema.ts          # Drizzle schema (all tables)
│   │   │   │   ├── migrate.ts         # Migration runner
│   │   │   │   └── client.ts          # DB connection
│   │   │   ├── routes/
│   │   │   │   ├── locks.ts           # CRUD + commit + revert + search
│   │   │   │   ├── products.ts        # Product CRUD + list
│   │   │   │   ├── features.ts        # Feature CRUD + list
│   │   │   │   └── health.ts          # Health check
│   │   │   ├── services/
│   │   │   │   ├── lock-service.ts    # Core decision logic
│   │   │   │   ├── conflict-service.ts # Embedding + conflict detection
│   │   │   │   ├── lineage-service.ts # Supersession + revert chains
│   │   │   │   └── notify-service.ts  # Cross-surface notifications (Slack)
│   │   │   ├── lib/
│   │   │   │   ├── embeddings.ts      # OpenAI embedding generation
│   │   │   │   ├── llm.ts            # Claude API for classification
│   │   │   │   ├── id.ts             # Short ID generation (l-xxxxxx)
│   │   │   │   └── auth.ts           # API key validation middleware
│   │   │   └── types.ts              # Shared TypeScript types
│   │   └── drizzle/
│   │       └── migrations/            # SQL migrations
│   │
│   ├── slack/                         # Slack bot surface
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts               # Bolt app entry point
│   │       ├── commands/
│   │       │   ├── lock.ts            # @lock <message> handler
│   │       │   ├── init.ts            # @lock init handler
│   │       │   ├── log.ts             # @lock log handler
│   │       │   ├── products.ts        # @lock products handler
│   │       │   ├── features.ts        # @lock features handler
│   │       │   ├── revert.ts          # @lock revert handler
│   │       │   └── link.ts            # @lock link handler
│   │       ├── lib/
│   │       │   ├── parser.ts          # Parse @lock commands + flags
│   │       │   ├── thread-context.ts  # Extract thread context from Slack API
│   │       │   └── formatters.ts      # Format responses as Slack blocks
│   │       └── types.ts
│   │
│   ├── cli/                           # CLI surface
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts               # CLI entry point (commander.js)
│   │       ├── commands/
│   │       │   ├── init.ts            # $ lock init
│   │       │   ├── commit.ts          # $ lock "message"
│   │       │   ├── log.ts             # $ lock log
│   │       │   ├── products.ts        # $ lock products
│   │       │   ├── features.ts        # $ lock features
│   │       │   ├── search.ts          # $ lock search "query"
│   │       │   ├── show.ts            # $ lock show <id>
│   │       │   ├── revert.ts          # $ lock revert <id>
│   │       │   └── link.ts            # $ lock link <id> <ref>
│   │       ├── lib/
│   │       │   ├── config.ts          # Read/write .lock/config.json
│   │       │   ├── api-client.ts      # HTTP client for core API
│   │       │   ├── credentials.ts     # Read/write ~/.lock/credentials
│   │       │   └── formatters.ts      # Terminal output formatting (chalk)
│   │       └── types.ts
│   │
│   └── mcp/                           # MCP server surface (for AI agents)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts               # MCP server entry point
│           ├── tools/
│           │   ├── query.ts           # lock.query tool
│           │   ├── commit.ts          # lock.commit tool
│           │   ├── list-products.ts   # lock.list_products tool
│           │   ├── list-features.ts   # lock.list_features tool
│           │   ├── get.ts             # lock.get tool
│           │   ├── get-lineage.ts     # lock.get_lineage tool
│           │   └── search-semantic.ts # lock.search_semantic tool
│           └── lib/
│               ├── api-client.ts      # HTTP client for core API
│               └── types.ts
│
└── scripts/
    ├── dev.sh                         # Start all services for local dev
    └── seed.ts                        # Seed DB with sample data
```

---

## Database Schema

Use Drizzle ORM with PostgreSQL. The schema lives in `packages/core/src/db/schema.ts`.

### Tables

```sql
-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Workspaces (tenants)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_team_id TEXT UNIQUE,           -- NULL if CLI-only workspace
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  slug TEXT NOT NULL,                  -- url-safe identifier (e.g. "trading")
  name TEXT NOT NULL,                  -- display name
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, slug)
);

-- Features
CREATE TABLE features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  slug TEXT NOT NULL,                  -- url-safe identifier (e.g. "margin-rework")
  name TEXT NOT NULL,
  description TEXT,
  slack_channel_id TEXT,               -- NULL if not linked to a Slack channel
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, slug)
);

-- Locks (decisions)
CREATE TABLE locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id TEXT NOT NULL UNIQUE,       -- human-readable ID: "l-a7f3e2"
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  product_id UUID NOT NULL REFERENCES products(id),
  feature_id UUID NOT NULL REFERENCES features(id),
  message TEXT NOT NULL,               -- the decision statement
  
  -- Author
  author_type TEXT NOT NULL CHECK (author_type IN ('human', 'agent')),
  author_id TEXT NOT NULL,             -- slack user ID, API key owner, agent name
  author_name TEXT NOT NULL,           -- display name
  author_source TEXT NOT NULL CHECK (author_source IN ('slack', 'cli', 'mcp', 'api')),
  
  -- Classification
  scope TEXT NOT NULL DEFAULT 'minor' CHECK (scope IN ('minor', 'major', 'architectural')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'reverted', 'proposed', 'auto')),
  tags TEXT[] DEFAULT '{}',
  
  -- Source context
  source_type TEXT NOT NULL CHECK (source_type IN ('slack', 'cli', 'agent_session', 'api')),
  source_ref TEXT,                     -- thread URL, session ID, etc.
  source_context TEXT,                 -- auto-captured surrounding context
  participants TEXT[] DEFAULT '{}',
  
  -- Lineage
  supersedes_id UUID REFERENCES locks(id),
  superseded_by_id UUID REFERENCES locks(id),
  reverted_by_id UUID REFERENCES locks(id),
  
  -- Embedding for semantic search
  embedding vector(1536),              -- OpenAI text-embedding-3-small dimension
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_locks_workspace ON locks(workspace_id);
CREATE INDEX idx_locks_product ON locks(product_id);
CREATE INDEX idx_locks_feature ON locks(feature_id);
CREATE INDEX idx_locks_status ON locks(status);
CREATE INDEX idx_locks_short_id ON locks(short_id);
CREATE INDEX idx_locks_embedding ON locks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- External links
CREATE TABLE lock_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_id UUID NOT NULL REFERENCES locks(id),
  link_type TEXT NOT NULL CHECK (link_type IN ('jira', 'figma', 'github', 'linear', 'notion', 'other')),
  link_ref TEXT NOT NULL,              -- ticket ID, URL, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Channel configurations (maps Slack channels to product+feature)
CREATE TABLE channel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  slack_channel_id TEXT NOT NULL UNIQUE,
  product_id UUID NOT NULL REFERENCES products(id),
  feature_id UUID NOT NULL REFERENCES features(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  key_hash TEXT NOT NULL UNIQUE,       -- SHA-256 hash of the API key
  key_prefix TEXT NOT NULL,            -- first 8 chars for identification (e.g. "lk_a7f3...")
  name TEXT NOT NULL,                  -- human-readable name ("philippe's CLI")
  scopes TEXT[] DEFAULT '{read,write}',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
```

---

## Core API Endpoints

All endpoints are under `/api/v1/`. Authentication is via `Authorization: Bearer <api_key>` header. The Slack bot calls the API internally (no auth needed for internal calls, use a shared secret).

### Locks

```
POST   /api/v1/locks                  # Commit a new decision
GET    /api/v1/locks                  # List/filter locks (query params: product, feature, scope, status, author, tags, limit, offset)
GET    /api/v1/locks/:shortId         # Get a single lock with full detail
POST   /api/v1/locks/:shortId/revert  # Revert a lock (body: { message, author })
POST   /api/v1/locks/:shortId/link    # Add a link to a lock (body: { link_type, link_ref })
POST   /api/v1/locks/search           # Semantic search (body: { query, product?, feature? })
```

**POST /api/v1/locks** body:
```json
{
  "message": "Use notional value instead of margin for position display",
  "product": "trading",
  "feature": "margin-rework",
  "scope": "major",
  "tags": ["display", "margin"],
  "author": {
    "type": "human",
    "id": "U1234567",
    "name": "philippe",
    "source": "slack"
  },
  "source": {
    "type": "slack",
    "ref": "https://ledger.slack.com/archives/C123/p456",
    "context": "Thread snippet of surrounding discussion...",
    "participants": ["philippe", "alice", "bob"]
  },
  "links": [
    { "type": "jira", "ref": "TRADE-442" }
  ]
}
```

**POST /api/v1/locks** response:
```json
{
  "lock": {
    "id": "uuid",
    "short_id": "l-a7f3e2",
    "message": "Use notional value instead of margin...",
    "product": { "slug": "trading", "name": "Trading" },
    "feature": { "slug": "margin-rework", "name": "Margin Rework" },
    "author": { ... },
    "scope": "major",
    "status": "active",
    "created_at": "2026-02-18T14:32:00Z"
  },
  "conflicts": [
    {
      "lock": { "short_id": "l-b8c4f1", "message": "Display all values in margin terms", ... },
      "relationship": "potential_conflict",
      "explanation": "These decisions contradict each other on what metric to display for positions."
    }
  ],
  "supersession": {
    "detected": true,
    "supersedes": { "short_id": "l-x9y2z3", "message": "Use margin for position display" },
    "explanation": "The new decision directly replaces the approach described in l-x9y2z3."
  }
}
```

### Products

```
GET    /api/v1/products               # List all products (with decision counts)
POST   /api/v1/products               # Create a product
PATCH  /api/v1/products/:slug         # Update description
```

### Features

```
GET    /api/v1/features               # List features (query param: product)
POST   /api/v1/features               # Create a feature
PATCH  /api/v1/features/:slug         # Update description
```

### Channel Configs

```
POST   /api/v1/channel-configs        # Map a Slack channel to product+feature
GET    /api/v1/channel-configs/:channelId  # Get config for a channel
```

---

## Conflict Detection Pipeline

When a new lock is committed, run this pipeline in `conflict-service.ts`:

### Step 1: Generate embedding
```typescript
// Use OpenAI text-embedding-3-small
const embedding = await generateEmbedding(lock.message);
```

### Step 2: Find similar active locks in the same product
```typescript
// pgvector cosine similarity search
// Find top 5 most similar ACTIVE locks in the same PRODUCT (cross-feature)
const candidates = await db.execute(sql`
  SELECT *, 1 - (embedding <=> ${embedding}) as similarity
  FROM locks
  WHERE product_id = ${lock.product_id}
    AND status = 'active'
    AND id != ${lock.id}
  ORDER BY embedding <=> ${embedding}
  LIMIT 5
`);
// Filter to similarity > 0.75 threshold
```

### Step 3: Classify relationships via LLM
```typescript
// For each candidate above threshold, call Claude to classify
const prompt = `You are analyzing product decisions for conflicts.

Decision A (existing, ${candidate.scope}): "${candidate.message}"
  Context: ${candidate.source_context}
  Feature: ${candidate.feature.name}

Decision B (new, ${lock.scope}): "${lock.message}"
  Context: ${lock.source_context}
  Feature: ${lock.feature.name}

Classify the relationship as exactly one of:
- "no_relation" — these decisions are about different things
- "related" — these are about the same area but don't conflict
- "potential_conflict" — these decisions may contradict each other
- "supersession" — Decision B replaces/updates Decision A

Respond with JSON: { "relationship": "...", "explanation": "..." }`;
```

### Performance target
Total pipeline: < 3 seconds. Embedding (~100ms) + pgvector query (~50ms) + LLM classification (~1-2s per candidate).

---

## Slack Bot Command Parsing

The Slack bot listens for `@lock` mentions in channels. Parse the message after the mention:

### Command patterns
```
@lock <message>                                    → commit a lock
@lock <message> --scope major --ticket TRADE-442   → commit with flags
@lock init --product <p> --feature <f>             → initialize channel
@lock log                                          → show recent locks
@lock log --product <p>                            → filter by product
@lock log --feature <f>                            → filter by feature
@lock log --scope major                            → filter by scope
@lock products                                     → list products
@lock features                                     → list features
@lock features --product <p>                       → list features for product
@lock revert <short_id> "reason"                   → revert a lock
@lock link <short_id> <ref>                        → add a link
@lock search "query"                               → semantic search
@lock describe --product <p> "description"         → describe a product
@lock describe --feature <f> "description"         → describe a feature
```

### Flag parsing
Extract these optional flags from any commit message:
- `--scope <minor|major|architectural>` (default: minor)
- `--ticket <TICKET-ID>` (creates a jira link)
- `--tag <tag>` (can appear multiple times)
- `--also <feature>` (cross-feature tagging)

Everything that isn't a flag or a known subcommand is the decision message.

### Thread context capture
When @lock is used in a thread, use the Slack API to:
1. Get the parent message and all replies
2. Extract participant user IDs, resolve to display names
3. Capture last 5 messages as context snippet
4. Get the thread permalink

---

## CLI Behavior

### Authentication
On first use, prompt the user to provide:
1. Lock API URL (default: https://api.lock.app)
2. API key

Store in `~/.lock/credentials`:
```json
{
  "api_url": "https://api.lock.app",
  "api_key": "lk_a7f3e2..."
}
```

### Project init
`$ lock init --product trading --feature margin-rework` creates `.lock/config.json` in the current directory:
```json
{
  "product": "trading",
  "feature": "margin-rework"
}
```

### Default commit
`$ lock "message"` reads `.lock/config.json` for product/feature, then calls `POST /api/v1/locks`.

If no `.lock/config.json` exists, error: "Run `lock init` first to scope this directory."

---

## MCP Server Tools

The MCP server exposes these tools for AI agents:

```typescript
// Read tools
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

// Write tools
lock_commit({ message, product?,        → { lock: {...}, conflicts: [...] }
              feature?, scope?,
              tags?, source? })
```

The MCP server is a thin wrapper that calls the Core API via HTTP. Auth is via API key passed in the MCP server config.

### MCP server config example (for Claude Code / Cursor)
```json
{
  "mcpServers": {
    "lock": {
      "command": "npx",
      "args": ["@uselock/mcp-server"],
      "env": {
        "LOCK_API_URL": "https://api.lock.app",
        "LOCK_API_KEY": "lk_a7f3e2..."
      }
    }
  }
}
```

---

## Cross-Surface Notifications

When a lock is committed from CLI or MCP (not Slack), the core engine should notify the relevant Slack channel if one is configured for that feature.

In `notify-service.ts`:
1. Look up `channel_configs` for the lock's feature
2. If a Slack channel is configured, post a message:
   ```
   🔒 New lock from {source} (l-xxxxxx)
      "{message}"
      Author: {name} via {source}
      [View in Lock]
   ```
3. Use Slack Web API (`chat.postMessage`) with Block Kit formatting

This requires the Slack bot token to be available in the core engine. Store it in the workspace record or env var.

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://lock:lock@localhost:5432/lock

# OpenAI (embeddings)
OPENAI_API_KEY=sk-...

# Anthropic (conflict classification)
ANTHROPIC_API_KEY=sk-ant-...

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...          # For socket mode (dev)

# App
API_PORT=3000
SLACK_PORT=3001
NODE_ENV=development
```

---

## Short ID Generation

Lock IDs are human-readable: `l-` + 6 hex characters (e.g., `l-a7f3e2`).

In `packages/core/src/lib/id.ts`:
```typescript
import crypto from 'crypto';

export function generateShortId(): string {
  return 'l-' + crypto.randomBytes(3).toString('hex');
}
```

Check for collisions on insert. If collision, regenerate.

---

## Build Order (Phase 0 MVP)

Build in this order to get a working system as fast as possible:

### 1. Core API + Database (Day 1-2)
- [ ] Set up monorepo with pnpm workspace
- [ ] Docker Compose with PostgreSQL + pgvector
- [ ] Drizzle schema + migrations
- [ ] Fastify server with health check
- [ ] `POST /api/v1/locks` — create a lock (no conflict detection yet)
- [ ] `GET /api/v1/locks` — list/filter locks
- [ ] `GET /api/v1/locks/:shortId` — get single lock
- [ ] `POST /api/v1/products` + `GET /api/v1/products`
- [ ] `POST /api/v1/features` + `GET /api/v1/features`
- [ ] `POST /api/v1/channel-configs`
- [ ] API key auth middleware
- [ ] Auto-create product/feature on first reference (upsert logic)

### 2. Slack Bot (Day 2-3)
- [ ] Bolt app setup with socket mode
- [ ] `@lock init --product <p> --feature <f>` command
- [ ] `@lock <message>` command (commit a lock)
- [ ] Flag parsing (--scope, --ticket, --tag)
- [ ] Thread context capture (participants, snippet, permalink)
- [ ] `@lock log` command with filters
- [ ] `@lock products` and `@lock features` commands
- [ ] Block Kit message formatting
- [ ] `@lock revert` and `@lock link` commands

### 3. CLI (Day 3-4)
- [ ] Commander.js setup with subcommands
- [ ] `lock init --product <p> --feature <f>` (creates .lock/config.json)
- [ ] `lock "message"` (commit a lock via API)
- [ ] `lock log` with filters
- [ ] `lock products` and `lock features`
- [ ] `lock show <id>` and `lock revert <id>`
- [ ] Credentials management (~/.lock/credentials)
- [ ] Terminal formatting with chalk

### 4. MCP Server (Day 4-5)
- [ ] MCP SDK setup
- [ ] Read tools: lock_query, lock_list_products, lock_list_features, lock_get, lock_search_semantic
- [ ] Write tools: lock_commit
- [ ] API client wrapper

### 5. Conflict Detection (Day 5-6)
- [ ] OpenAI embedding generation on lock commit
- [ ] pgvector similarity search
- [ ] Claude API classification (conflict vs. supersession vs. unrelated)
- [ ] Return conflicts/supersession in lock commit response
- [ ] Slack interactive messages for conflict resolution ([Lock anyway] [Cancel])

### 6. Cross-Surface Notifications (Day 6-7)
- [ ] Notify service: post to Slack when locks come from CLI/MCP
- [ ] Format notifications with Block Kit

---

## Code Style & Conventions

- **Language**: TypeScript (strict mode) throughout
- **Modules**: ESM (`"type": "module"` in package.json)
- **Formatting**: Prettier (default config)
- **Linting**: ESLint with @typescript-eslint
- **Error handling**: Use Fastify's error handling. Return structured errors: `{ error: { code: "LOCK_NOT_FOUND", message: "..." } }`
- **Naming**: camelCase for variables/functions, PascalCase for types, kebab-case for files
- **Database**: Always use parameterized queries. Never concatenate SQL strings.
- **API responses**: Always wrap in `{ data: ... }` for success, `{ error: ... }` for errors
- **Logging**: Use Fastify's built-in pino logger

---

## Important Design Decisions

1. **Product/Feature are auto-created**: When someone runs `@lock init --product trading --feature margin-rework`, if "trading" doesn't exist, create it. No admin step.

2. **Locks are immutable**: Once committed, a lock's message can't be edited. You can only revert (which creates a new lock) or supersede (new lock replaces old one).

3. **Conflict detection is cross-feature but within-product**: A decision in `margin-rework` is checked against decisions in `ui` and `risk-engine` if they're all under `trading`.

4. **Slack is the awareness layer**: Even when decisions come from CLI or MCP, they're surfaced in Slack. Slack is where the team "sees" what's happening.

5. **The CLI and MCP server are thin clients**: They just call the REST API. All business logic lives in the core engine.

6. **Short IDs are for humans, UUIDs are for the database**: External APIs accept both. Routes use short_id. Internal references use UUID.
