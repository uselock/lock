# Self-Hosting

Lock is designed to run on your own infrastructure. This guide covers everything you need to deploy and operate a Lock instance.

## Architecture

```
                    ┌──────────────┐
                    │  Slack Bot   │ (optional)
                    └──────┬───────┘
                           │
┌──────────┐   ┌───────────┴────────────┐   ┌──────────────┐
│  CLI     │───│     Core API           │───│  PostgreSQL  │
└──────────┘   │     (Fastify)          │   │  + pgvector  │
               │                        │   └──────────────┘
┌──────────┐   │  - Decision CRUD       │
│  MCP     │───│  - Conflict detection  │
│  Server  │   │  - Lineage tracking    │
└──────────┘   │  - Notifications       │
               └────────────────────────┘
                     │            │
              ┌──────┴──┐  ┌─────┴──────┐
              │ OpenAI  │  │  Anthropic  │
              │ (embed) │  │  (classify) │
              └─────────┘  └────────────┘
```

The core API is the only stateful component. The Slack bot, CLI, and MCP server are all thin clients that call the API.

## Prerequisites

- **Node.js 20+**
- **pnpm 9+**
- **PostgreSQL 16** with the **pgvector** extension
- **OpenAI API key** (for semantic embeddings)
- **Anthropic API key** (for conflict classification)
- **Slack app** (optional, for Slack integration)

## Quick Start (Docker)

### 1. Clone and Install

```bash
git clone https://github.com/your-org/lock.git
cd lock
pnpm install
```

### 2. Start the Database

```bash
pnpm db:up
```

This starts PostgreSQL 16 with pgvector via Docker Compose:

```yaml
# docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: lock
      POSTGRES_PASSWORD: lock
      POSTGRES_DB: lock
    ports:
      - "5432:5432"
    volumes:
      - lock_data:/var/lib/postgresql/data
```

The `pgvector` and `pgcrypto` extensions are automatically enabled on first start.

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Database
DATABASE_URL=postgresql://lock:lock@localhost:5432/lock

# OpenAI (for embedding generation)
OPENAI_API_KEY=sk-...

# Anthropic (for conflict classification)
ANTHROPIC_API_KEY=sk-ant-...

# Slack (optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...

# App
API_PORT=3000
SLACK_PORT=3001
NODE_ENV=development

# Internal service-to-service auth
INTERNAL_SECRET=change-me-to-a-random-string
```

### 4. Run Migrations

```bash
pnpm db:migrate
```

### 5. Build and Start

```bash
pnpm build
pnpm dev          # Core API + Slack bot
# or
pnpm dev:core     # Just the core API
```

The API will be available at `http://localhost:3000`.

### 6. Create an API Key

Open `http://localhost:3000` in your browser to access the admin UI. Create a workspace and generate an API key.

---

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | — |
| `OPENAI_API_KEY` | No | OpenAI API key for embeddings | Disables semantic search |
| `ANTHROPIC_API_KEY` | No | Anthropic API key for conflict classification | Disables LLM classification |
| `SLACK_BOT_TOKEN` | No | Slack bot token (`xoxb-...`) | Disables Slack bot |
| `SLACK_SIGNING_SECRET` | No | Slack signing secret | — |
| `SLACK_APP_TOKEN` | No | Slack app-level token (`xapp-...`) for socket mode | — |
| `API_PORT` | No | Port for the core API | `3000` |
| `SLACK_PORT` | No | Port for the Slack bot | `3001` |
| `NODE_ENV` | No | `development` or `production` | `development` |
| `INTERNAL_SECRET` | Yes | Shared secret for Slack bot <-> API auth | — |

### Degraded Modes

Lock works without external AI services, with reduced functionality:

- **Without OpenAI**: Semantic search falls back to text search (ILIKE). Conflict detection is disabled.
- **Without Anthropic**: Conflict classification is disabled. Similar decisions are still found via embeddings, but relationships aren't classified.
- **Without Slack tokens**: Slack bot won't start. Cross-surface notifications to Slack are disabled. CLI and MCP still work.

---

## Database

### PostgreSQL with pgvector

Lock requires PostgreSQL 16+ with the pgvector extension for storing and querying vector embeddings. The Docker Compose setup handles this automatically.

If you're running your own PostgreSQL instance, install pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Migrations

Migrations are managed by Drizzle ORM and live in `packages/core/drizzle/migrations/`.

```bash
pnpm db:migrate
```

### Schema

The database has 6 tables:

| Table | Purpose |
|-------|---------|
| `workspaces` | Multi-tenant isolation (one per Slack workspace or org) |
| `products` | Top-level containers for decisions |
| `features` | Scoped areas within products |
| `locks` | Decision records with embeddings |
| `lock_links` | External references (Jira, GitHub, etc.) |
| `channel_configs` | Slack channel to product/feature mappings |
| `api_keys` | Authentication keys (stored as SHA-256 hashes) |

---

## Slack App Setup

### Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app from scratch
3. Enable **Socket Mode** (for development) or configure **Event Subscriptions** (for production)

### Required Scopes (Bot Token Scopes)

| Scope | Purpose |
|-------|---------|
| `app_mentions:read` | Receive @lock mentions |
| `chat:write` | Post responses and notifications |
| `channels:history` | Read thread context |
| `groups:history` | Read thread context in private channels |
| `users:read` | Resolve user display names |

### Event Subscriptions

Subscribe to the `app_mention` event.

### Running the Slack Bot

```bash
pnpm dev:slack
```

The bot uses socket mode in development. For production, configure HTTP webhooks to point to your Slack bot's URL.

---

## Production Deployment

### Building for Production

```bash
pnpm build
```

This compiles all TypeScript packages to JavaScript in their respective `dist/` directories.

### Running in Production

```bash
# Core API
NODE_ENV=production node packages/core/dist/index.js

# Slack bot (if needed)
NODE_ENV=production node packages/slack/dist/index.js
```

### Health Check

```
GET /health
```

Returns `{ "status": "ok", "timestamp": "..." }`. Use this for load balancer health checks.

### Recommended Setup

- Run the core API behind a reverse proxy (nginx, Caddy, etc.)
- Use a managed PostgreSQL instance with pgvector support
- Set `NODE_ENV=production` for production logging and error handling
- Use a strong, random `INTERNAL_SECRET` for Slack bot <-> API auth
- Keep API keys secure — they're only shown once at creation time

---

## Development

### Running All Services

```bash
pnpm dev          # Core API + Slack bot (concurrently)
```

### Running Individual Services

```bash
pnpm dev:core     # Core API only
pnpm dev:slack    # Slack bot only
pnpm dev:cli      # CLI in dev mode
pnpm dev:mcp      # MCP server in dev mode
```

### Type Checking

```bash
pnpm typecheck    # All packages
```

### Project Structure

```
lock/
├── packages/
│   ├── core/        # Fastify API — all business logic
│   ├── slack/       # Slack bot (thin client)
│   ├── cli/         # CLI (thin client)
│   └── mcp/         # MCP server for AI agents (thin client)
├── scripts/
│   ├── init-db.sql  # Database initialization
│   └── seed.ts      # Sample data seeding
└── docker-compose.yml
```

### Monorepo Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages |
| `pnpm dev` | Start core API + Slack bot |
| `pnpm dev:core` | Start core API only |
| `pnpm dev:slack` | Start Slack bot only |
| `pnpm dev:cli` | Run CLI in dev mode |
| `pnpm dev:mcp` | Run MCP server in dev mode |
| `pnpm db:up` | Start PostgreSQL via Docker |
| `pnpm db:down` | Stop PostgreSQL |
| `pnpm db:migrate` | Run database migrations |
| `pnpm typecheck` | Type-check all packages |
