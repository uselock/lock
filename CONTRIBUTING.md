# Contributing to Lock

Thanks for your interest in contributing to Lock! This document covers the basics for getting started.

## Development setup

```bash
git clone https://github.com/GuitareCiel/lock.git
cd lock
pnpm install
cp .env.example .env   # Edit with your API keys
pnpm db:up             # Start PostgreSQL via Docker
pnpm db:migrate        # Apply schema
pnpm build             # Build all packages
pnpm dev               # Start core API + Slack bot
```

See the [README](README.md) for full setup details.

## Project structure

Lock is a pnpm monorepo with four packages:

- `packages/core` — Fastify API, all business logic
- `packages/slack` — Slack bot surface
- `packages/cli` — Terminal client
- `packages/mcp` — MCP server for AI agents

All business logic lives in `core`. The other packages are thin clients that call the REST API.

## Making changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add tests if you're adding new functionality
4. Run `pnpm build` to make sure everything compiles
5. Run `pnpm test` to make sure all tests pass
6. Open a pull request

## Code style

- TypeScript with strict mode
- ESM modules throughout (`"type": "module"`)
- camelCase for variables/functions, PascalCase for types, kebab-case for files
- Structured errors: `{ error: { code: "...", message: "..." } }`
- API responses: `{ data: ... }` for success

## Tests

```bash
pnpm test            # All tests
pnpm test:unit       # Unit tests only (no DB required)
pnpm test:e2e        # E2e tests (requires DATABASE_URL)
```

Unit tests should not require a database or external services. E2e tests run against a real PostgreSQL instance.

## Reporting bugs

Open an issue on GitHub with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, deployment method)

## Security issues

Do **not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.
