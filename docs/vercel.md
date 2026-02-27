# Deploying Lock to Vercel

You can deploy **only the Lock Core API** to Vercel. The Slack bot cannot run on Vercel and must be hosted elsewhere (see below).

## What runs where

| Component   | Vercel? | Notes |
|------------|---------|--------|
| **Core API** | ✅ Yes | Fastify is [supported on Vercel](https://vercel.com/docs/frameworks/backend/fastify) with zero config. |
| **Slack bot** | ❌ No  | Uses Socket Mode (persistent WebSocket). Run on [Railway](https://railway.app), [Render](https://render.com), [Fly.io](https://fly.io), or any Node host. |
| **PostgreSQL** | External | Use [Neon](https://neon.tech) or [Supabase](https://supabase.com); both support **pgvector**. |

The Slack app will call your Core API at its Vercel URL (`https://your-project.vercel.app`).

## 1. Database (Neon or Supabase)

Create a Postgres database and enable the `vector` extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

- **Neon**: [pgvector extension](https://neon.com/docs/extensions/pgvector). Use the **pooled** connection string (serverless-friendly).
- **Supabase**: [Vector module](https://supabase.com/modules/vector). Use the pooler connection string for serverless.

Run schema once (from your machine or a one-off script):

```bash
cd lock
DATABASE_URL="postgresql://..." pnpm --filter @uselock/core db:push
```

## 2. Deploy Core API to Vercel

### Option A: Vercel Dashboard (monorepo)

1. Import your Git repo.
2. Set **Root Directory** to `packages/core`.
3. **Build Command**: `pnpm install && pnpm build`  
   (If Vercel runs install from repo root when it detects the monorepo, `pnpm build` alone may be enough.)
4. **Environment variables** (in Vercel project settings):

   | Variable | Required | Notes |
   |----------|----------|--------|
   | `DATABASE_URL` | Yes | Pooled Postgres URL (Neon/Supabase). |
   | `OPENAI_API_KEY` | Yes* | For embeddings and conflict detection. Omit to disable. |
   | `INTERNAL_SECRET` | Yes (if using Slack) | Shared secret for Slack bot → Core API auth. |
   | `NODE_ENV` | No | Set to `production`. |

5. Deploy. Your API will be at `https://<project>.vercel.app`.

### Option B: Vercel CLI

From the repo root:

```bash
pnpm add -D vercel
vercel link
# Set Root Directory to packages/core when prompted, or in Project Settings
vercel env add DATABASE_URL
vercel env add OPENAI_API_KEY
vercel env add INTERNAL_SECRET
vercel --prod
```

## 3. Run the Slack bot elsewhere

Point the Slack app at your Vercel API:

```env
LOCK_API_URL=https://your-project.vercel.app
INTERNAL_SECRET=<same as on Vercel>
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...
```

Deploy the Slack package as a long-running Node process (e.g. `node dist/index.js` or `pnpm start` in `packages/slack`) on Railway, Render, Fly.io, or a small VPS. Only the Core API is on Vercel.

## 4. CLI and MCP

Configure the CLI and MCP server to use your Vercel URL:

```bash
lock login --url https://your-project.vercel.app --key lk_...
```

Create the API key from the Lock Admin UI: `https://your-project.vercel.app` (first visit may need a one-off workspace bootstrap if you use the internal Slack flow).

## Limitations

- **Vercel function limits**: Execution timeout (e.g. 60s on Pro), 250MB size. For normal Lock usage (commit, list, search) this is sufficient.
- **Cold starts**: First request after idle can be slower; Fluid compute can reduce this (opt-in in Vercel).
- **Slack bot**: Must always run on a platform that supports a persistent process (not serverless).

## Summary

- **Core API** → Vercel (Fastify supported; use pooled Postgres + pgvector).
- **Slack bot** → Any Node host (Railway, Render, Fly.io, etc.) with `LOCK_API_URL` and `INTERNAL_SECRET` set.
- **Database** → Neon or Supabase with pgvector and pooled connection string.
