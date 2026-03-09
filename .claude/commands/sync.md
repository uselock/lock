# Sync: Private Repo → Public Open-Source Repo

## Overview

This project uses a **single private repo** (`GuitareCiel/lock-private`) for all development. The public open-source repo (`uselock/lock`) is a **filtered mirror** — it receives only the open-source files, never SaaS code.

## Architecture

```
GuitareCiel/lock-private (origin)     uselock/lock (public)
├── packages/core/      ──sync──►     ├── packages/core/
├── packages/cli/       ──sync──►     ├── packages/cli/  (minus signup.ts, device-flow.ts, templates/)
├── packages/mcp/       ──sync──►     ├── packages/mcp/
├── packages/slack/     ──sync──►     ├── packages/slack/
├── packages/saas/      ✗ excluded    ├── scripts/
├── packages/web/       ✗ excluded    ├── docs/
├── .github/            ✗ excluded    └── config files
└── scripts/            ──sync──►
```

## Git Remotes

```
origin  → git@github.com:GuitareCiel/lock-private.git   (daily pushes)
public  → git@github.com:uselock/lock.git            (manual reference only)
```

## Day-to-Day Workflow

All development happens on `origin` (private repo):

```bash
git add <files>
git commit -m "your message"
git push origin main
```

Never push directly to the `public` remote. The GitHub Action handles that.

## Releasing to Open Source

Tag and push — the GitHub Action (`sync-public.yml`) does the rest:

```bash
git tag v0.x.x
git push origin v0.x.x
```

The action:
1. Checks out both repos in CI
2. Runs `scripts/sync-public.sh` (rsync with exclusions)
3. Strips private sections from CLAUDE.md
4. Commits and pushes to `uselock/lock`
5. Mirrors the tag on the public repo

You can also trigger manually: lock-private → Actions → "Sync to Public Repo" → Run workflow.

## What Gets Excluded

The sync script (`scripts/sync-public.sh`) excludes:

| Path | Reason |
|------|--------|
| `packages/saas/` | Auth, billing, user management, usage limits |
| `packages/web/` | Next.js web dashboard |
| `.github/` | Private CI/CD workflows (deploy, sync) |
| `packages/cli/src/commands/signup.ts` | SaaS-only signup flow |
| `packages/cli/src/lib/device-flow.ts` | SaaS-only OAuth device flow |
| `packages/cli/src/templates/` | Internal CLI templates |
| `node_modules/`, `dist/`, `.env` | Build artifacts and secrets |

## Post-Sync Verification

The sync script automatically checks:
1. **No SaaS imports in core** — scans for `billing-service`, `user-service`, `email-service`, `usage-service`, `./jwt`, `bcryptjs`, `stripe`, `@fastify/cookie`
2. **No private references in CLAUDE.md** — scans for `private monorepo`, `packages/saas`, `packages/web`, `lock-private`, `sync-public`

If either check fails, the script warns but does not abort.

## The Core/SaaS Boundary

These rules MUST be followed to keep the sync clean:

1. **Core never imports SaaS.** Dependency flows one way: `saas → core`.
2. **SaaS extends core via extension points:**
   - `buildApp(options)` — Fastify factory, accepts plugins and routes
   - `registerAuthStrategy(fn)` — pluggable auth (SaaS adds session/JWT)
   - `onBeforeCommit(fn)` / `onAfterCommit(fn)` — hooks (SaaS adds usage limits)
3. **SaaS-only deps** stay in `packages/saas/package.json`: `bcryptjs`, `jose`, `stripe`, `@fastify/cookie`
4. **SaaS-only tables** stay in `packages/saas/src/db/schema.ts`: `users`, `sessions`, `workspaceMembers`, `workspaceInvites`, `subscriptions`
5. **CLI conditional features** use dynamic `import()` with try/catch — missing files = graceful fallback

## GitHub Action Secret

The sync action uses `PUBLIC_REPO_TOKEN` (classic PAT with `repo` scope) stored in lock-private's repository secrets. This token must have push access to `uselock/lock`.

## Fixing a Failed Sync

If the action fails:
1. Check the Actions log on `GuitareCiel/lock-private`
2. Common issues: token expired (rotate `PUBLIC_REPO_TOKEN`), rsync exclusion missing (update `sync-public.sh`)
3. Fix, commit, push, then re-tag:
   ```bash
   git push origin main
   git tag -f v0.x.x
   git push origin v0.x.x -f
   ```

## Adding New Private Files

When you create a new file/directory that should NOT go to the public repo:
1. Add an `--exclude` line to `scripts/sync-public.sh`
2. If it contains importable code, add a grep pattern to the verification loop
3. Test locally: `bash scripts/sync-public.sh /tmp/lock-test`
