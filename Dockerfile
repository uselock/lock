# Stage 1: base image with pnpm
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Stage 2: install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/slack/package.json packages/slack/
RUN pnpm install --frozen-lockfile

# Stage 3: build TypeScript
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/core/ packages/core/
COPY packages/slack/ packages/slack/
RUN pnpm --filter @uselock/core build && pnpm --filter @uselock/slack build

# Stage 4: production image
FROM base AS production
ENV NODE_ENV=production

# Copy full node_modules (drizzle-kit needed for schema push)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/slack/node_modules ./packages/slack/node_modules

# Copy package manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/slack/package.json packages/slack/

# Copy built artifacts
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/slack/dist ./packages/slack/dist

# Copy schema + drizzle config (needed for drizzle-kit push)
COPY packages/core/src/db/schema.ts packages/core/src/db/
COPY packages/core/drizzle.config.ts packages/core/

# Copy entrypoint + init-db script
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
COPY scripts/init-db.sql /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint.sh

# Install pg_isready for health check wait loop + bash for entrypoint
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client bash && rm -rf /var/lib/apt/lists/*

# Run as non-root user
RUN addgroup --system lock && adduser --system --ingroup lock lock
USER lock

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
