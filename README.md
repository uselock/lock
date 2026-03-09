# Lock

Decision tracking for product teams. Records product decisions where they happen — Slack, terminal, or AI agent sessions — so you always know why something was built a certain way.

```
@lock Use notional value instead of margin for position display
```

```
$ lock "Use notional value instead of margin for position display"
```

Lock captures the decision, classifies its type, detects conflicts with existing decisions, and notifies the team in Slack. If a conflict is found, the user is warned and asked to confirm before committing.

## How it works

Lock has one core API and multiple input surfaces:

- **Slack bot** — `@lock <decision>` in any channel. Supports 3 modes: explicit, extract from thread, and polish.
- **CLI** — `lock "<decision>"` from the terminal
- **MCP server** — AI agents (Claude Code, Cursor) read and write decisions via tools
- **REST API** — direct HTTP calls
- **GitHub Action** — comments on PRs with relevant locked decisions

Decisions are stored in PostgreSQL with optional vector embeddings. When a new decision is committed, Lock searches for conflicting or superseding decisions across the same product and flags them. Each decision is automatically classified into a type (product, technical, business, design, or process) by the LLM.

### LLM providers

Lock supports **both Anthropic (Claude) and OpenAI** for LLM operations:

| | Anthropic only | OpenAI only | Both |
|---|---|---|---|
| Decision extraction | Claude Haiku 4.5 | gpt-4o-mini | Claude Haiku 4.5 |
| Conflict classification | Claude Haiku 4.5 | gpt-4o-mini | Claude Haiku 4.5 |
| Decision type inference | Claude Haiku 4.5 | gpt-4o-mini | Claude Haiku 4.5 |
| Embeddings / vector search | Text fallback | OpenAI embeddings | OpenAI embeddings |
| Conflict detection | Text similarity + LLM | Vector similarity + LLM | Vector similarity + LLM |

When both keys are set, Anthropic is used for all LLM calls and OpenAI for embeddings. With only an Anthropic key, conflict detection uses word-based text similarity instead of vector search — still effective, just less semantic.

## Quick Start (Docker)

The fastest way to run Lock. Requires Docker.

### 1. Clone and configure

```bash
git clone https://github.com/uselock/lock.git
cd lock
cp .env.example .env
```

Edit `.env` with your API keys:

```env
# At least one LLM key is required
ANTHROPIC_API_KEY=sk-ant-...       # Recommended — used for all LLM operations
OPENAI_API_KEY=sk-...              # Optional — adds vector embeddings for semantic search

# Slack (optional — skip if not using the Slack surface)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...

# Internal auth (set to any random string)
INTERNAL_SECRET=change-me-to-something-random
```

### 2. Start everything

```bash
docker compose up -d
```

This starts PostgreSQL (with pgvector), applies the database schema, and runs the Core API + Slack bot. The API is available at `http://localhost:3000`.

### 3. Create an API key

Use the CLI to authenticate:

```bash
pnpm --filter @uselock/cli build
node packages/cli/dist/index.js login --url http://localhost:3000
```

Or insert an API key directly into the database — see the [self-hosting guide](docs/self-hosting.md) for details.

### 4. Verify

```bash
curl http://localhost:3000/health
```

## Development Setup

For contributors working on Lock itself.

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Docker** (for PostgreSQL)
- **Anthropic API key** and/or **OpenAI API key** — at least one is required

Optional:
- **Slack workspace** with permissions to create apps (for the Slack bot surface)

### 1. Clone and install

```bash
git clone https://github.com/uselock/lock.git
cd lock
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```env
DATABASE_URL=postgresql://lock:lock@localhost:5432/lock

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...              # Optional — for vector embeddings

# Slack (optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...

API_PORT=3000
SLACK_PORT=3001
NODE_ENV=development
INTERNAL_SECRET=<random-string-for-service-to-service-auth>
```

### 3. Start the database

```bash
pnpm db:up
```

This starts PostgreSQL 16 with pgvector via Docker Compose.

### 4. Run migrations

```bash
pnpm db:migrate
```

### 5. Build all packages

```bash
pnpm build
```

### 6. Start development servers

```bash
# Core API + Slack bot
pnpm dev

# Or individually:
pnpm dev:core    # Core API on :3000
pnpm dev:slack   # Slack bot on :3001
pnpm dev:cli     # CLI in dev mode
pnpm dev:mcp     # MCP server in dev mode
```

### 7. Run tests

```bash
pnpm test            # All tests
pnpm test:unit       # Unit tests only
pnpm test:e2e        # E2e tests (requires DATABASE_URL)
```

## Slack app setup

You can create a Slack app using the included manifest file (`slack-app-manifest.yml`):

1. Go to https://api.slack.com/apps
2. Click **Create New App** > **From a manifest**
3. Select your workspace, paste the contents of `slack-app-manifest.yml`, and create
4. Under **Install App**, install to your workspace
5. Copy the tokens into `.env`:
   - **Bot User OAuth Token** (`xoxb-...`) -> `SLACK_BOT_TOKEN`
   - **Signing Secret** (under Basic Information) -> `SLACK_SIGNING_SECRET`
   - **App-Level Token** (generate one with `connections:write` scope) -> `SLACK_APP_TOKEN`

### Slack commands

| Command | Description |
|---------|-------------|
| `@lock <message>` | Record a decision |
| `@lock this` | Extract a decision from a thread |
| `@lock init --product <p> --feature <f>` | Set up a channel |
| `@lock log` | Recent decisions |
| `@lock search "<query>"` | Find decisions |
| `@lock recap` | Summary of active decisions |
| `@lock revert <id> "reason"` | Revert a decision |
| `@lock products` | List products |
| `@lock features` | List features |

After committing, each lock message includes buttons for adding scope, Jira tickets, Figma links, and tags. See the [full command reference](docs/slack.md) for all commands and flags.

## CLI setup

Install the CLI globally:

```bash
npm install -g @uselock/cli
```

Or build from source:

```bash
pnpm --filter @uselock/cli build
cd packages/cli && pnpm link --global
```

### Authenticate

```bash
lock login
```

This prompts for your Lock API URL and API key, validates them against the server, and saves credentials to `~/.lock/credentials`.

For non-interactive use (CI/scripts):

```bash
lock login --url http://localhost:3000 --key lk_your_api_key
```

### Initialize a project directory

```bash
cd ~/your-project
lock init --product trading --feature margin-rework
```

This creates `.lock/config.json` in the current directory. If Claude Code or Cursor is detected, it also offers to configure the MCP server and install a decision protocol skill. Use `--skip-ide` to bypass IDE setup.

Now you can commit decisions:

```bash
lock "Use notional value instead of margin for position display"
lock log
lock recap              # summary with type/scope breakdown
lock export             # generates LOCK.md with all active decisions
```

### CLI commands

| Command | Description |
|---------|-------------|
| `lock "<message>"` | Commit a decision |
| `lock commit <msg> --scope major --type technical` | Commit with options |
| `lock log [--type] [--scope] [--product] [--feature]` | List recent decisions |
| `lock show <id>` | Show a single decision |
| `lock search "<query>"` | Semantic search |
| `lock check "<intent>"` | Check for constraints before building |
| `lock recap [--product] [--since]` | Recap with stats and breakdown |
| `lock revert <id>` | Revert a decision |
| `lock link <id> <ref>` | Add an external link |
| `lock export` | Export active decisions to `LOCK.md` |
| `lock products` | List products |
| `lock features` | List features |
| `lock init` | Initialize project directory |
| `lock login` | Authenticate with a Lock server |
| `lock logout` | Remove stored credentials |
| `lock whoami` | Show current credentials and connection status |

## MCP server setup (for AI agents)

The MCP server lets AI coding tools read and write decisions.

### Recommended: via `lock init`

```bash
lock login          # authenticate (once per machine)
cd ~/your-project
lock init           # detects Claude Code/Cursor, configures automatically
```

`lock init` writes `.mcp.json` (Claude Code) or `.cursor/mcp.json` (Cursor) with no secrets — credentials are read from `~/.lock/credentials`.

### Manual

Add to `.mcp.json` (Claude Code) or `.cursor/mcp.json` (Cursor):

```json
{
  "mcpServers": {
    "lock": {
      "command": "npx",
      "args": ["@uselock/mcp"],
      "env": {
        "LOCK_API_URL": "http://localhost:3000",
        "LOCK_API_KEY": "lk_your_api_key"
      }
    }
  }
}
```

### MCP tools

| Tool | Description |
|------|-------------|
| `lock_context` | All active decisions as formatted markdown. Separates architectural constraints from other decisions. |
| `lock_check` | Pre-build constraint check. Splits results into blocking (architectural/major) and informational (minor). |
| `lock_commit` | Record a new decision (auto-classified with decision type). |
| `lock_recap` | Summary of recent decisions with scope/type breakdown and top contributors. |
| `lock_query` | Query decisions with filters (product, feature, scope, status, type, tags). |
| `lock_get` | Get a single decision by ID. |
| `lock_get_lineage` | Get the supersession/revert chain for a decision. |
| `lock_search_semantic` | Semantic search across decisions. |
| `lock_list_products` | List all products. |
| `lock_list_features` | List features, optionally filtered by product. |

## GitHub Action

Lock includes a standalone GitHub Action that comments on PRs with relevant locked decisions.

```yaml
# .github/workflows/lock-check.yml
name: Lock Decision Check
on:
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: uselock/lock/actions/check-decisions@main
        with:
          lock-api-url: ${{ secrets.LOCK_API_URL }}
          lock-api-key: ${{ secrets.LOCK_API_KEY }}
          product: trading  # optional
```

The action searches for decisions relevant to the PR title and body, and posts an advisory comment listing related locks.

## API

All endpoints are under `/api/v1/`. Auth via `Authorization: Bearer <api_key>`.

### Locks

```
POST   /api/v1/locks                    # Commit a decision
GET    /api/v1/locks                    # List/filter (query: product, feature, scope, status, decision_type, limit, offset)
POST   /api/v1/locks/pre-check          # Check for conflicts before committing
POST   /api/v1/locks/extract            # Extract a decision from thread context (LLM)
POST   /api/v1/locks/extract-batch      # Batch extract decisions from messages (LLM)
POST   /api/v1/locks/search             # Semantic search (body: { query, product?, feature? })
GET    /api/v1/locks/recap              # Recap with stats (query: product?, since?, limit?)
GET    /api/v1/locks/:shortId           # Get one decision
PATCH  /api/v1/locks/:shortId           # Update scope, tags, or decision_type
GET    /api/v1/locks/:shortId/lineage   # Get supersession/revert chain
POST   /api/v1/locks/:shortId/revert    # Revert a decision
POST   /api/v1/locks/:shortId/link      # Add an external link
```

### Products & Features

```
GET    /api/v1/products                 # List products with decision counts
POST   /api/v1/products                 # Create a product
PATCH  /api/v1/products/:slug           # Update name/description
GET    /api/v1/features                 # List features (query: product)
POST   /api/v1/features                 # Create a feature
PATCH  /api/v1/features/:slug           # Update name/description
```

Products and features are auto-created on first reference — no admin step needed.

### Decision types

Every decision is automatically classified by the LLM into one of 5 types:

| Type | Description |
|------|-------------|
| `product` | User-facing features, behavior, requirements |
| `technical` | Engineering, infrastructure, architecture, tooling |
| `business` | Pricing, strategy, metrics, KPIs |
| `design` | UI/UX, visual design, branding |
| `process` | Team workflow, methodology, documentation |

Override with `--type <type>` on any surface, or filter with `--type` in log/query.

## Conflict detection

When committing a decision, Lock checks for existing decisions that may conflict:

1. **Pre-check** (Slack) — Before committing, Lock searches for similar active decisions in the same product. If conflicts are found, the user sees a warning with the conflicting decisions and an LLM-generated explanation. They can choose to **Commit anyway** or **Cancel**.

2. **Post-commit** (CLI, MCP, API) — After committing, conflicts and supersessions are detected and returned in the response.

Detection uses **vector similarity** (pgvector + OpenAI embeddings) when available, or **text similarity** (word-based Jaccard) as a fallback. Both paths use the LLM to classify the relationship and explain the conflict.

## Project structure

```
lock/
├── packages/
│   ├── core/                # Fastify API — all business logic
│   ├── slack/               # Slack bot (@slack/bolt, socket mode)
│   ├── cli/                 # Terminal client (commander.js)
│   └── mcp/                 # MCP server for AI agents
├── actions/
│   └── check-decisions/     # GitHub Action (standalone, built with ncc)
├── scripts/
│   ├── docker-entrypoint.sh # Waits for PG, runs schema push, starts services
│   └── init-db.sql          # Enables pgvector + pgcrypto extensions
├── Dockerfile               # Multi-stage build for production
├── docker-compose.yml       # PostgreSQL + pgvector + Lock app
├── slack-app-manifest.yml   # Slack app manifest for easy setup
├── .env.example             # Environment template
└── CLAUDE.md                # Full architecture spec
```

## Telemetry

Lock includes **opt-in** anonymous telemetry to help us understand adoption. It is **disabled by default**.

To enable, set `LOCK_TELEMETRY=true` in your environment. Once enabled, the core API sends a single anonymous heartbeat every 24 hours with aggregate stats: number of workspaces, lock count bracket, which surfaces are active, and whether LLM keys are configured. No decision content, user names, or API keys are ever sent.

To disable (or if you never enabled it), no data is sent — there is nothing to turn off.

See the full implementation: [`packages/core/src/services/telemetry-service.ts`](packages/core/src/services/telemetry-service.ts)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)

## Stopping services

```bash
# Docker deployment
docker compose down

# Development database only
pnpm db:down
```
