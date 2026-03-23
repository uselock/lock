# Stage 1: base image with pnpm
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Stage 2: install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/slack/package.json packages/slack/
COPY packages/saas/package.json packages/saas/
RUN pnpm install --frozen-lockfile

# Stage 3: build TypeScript
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/core/ packages/core/
COPY packages/slack/ packages/slack/
COPY packages/saas/ packages/saas/
RUN pnpm --filter @uselock/core build && pnpm --filter @uselock/slack build && pnpm --filter @uselock/saas build

# Stage 4a: open-source production image (core + slack only)
FROM base AS core
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/slack/node_modules ./packages/slack/node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/slack/package.json packages/slack/

COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/slack/dist ./packages/slack/dist

COPY packages/core/src/db/schema.ts packages/core/src/db/
COPY packages/core/drizzle.config.ts packages/core/

COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
COPY scripts/init-db.sql /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint.sh

RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client bash && rm -rf /var/lib/apt/lists/*

RUN addgroup --system lock && adduser --system --ingroup lock lock
USER lock

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]

# Stage 4b: SaaS production image (core + slack + saas)
FROM base AS saas
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/slack/node_modules ./packages/slack/node_modules
COPY --from=deps /app/packages/saas/node_modules ./packages/saas/node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/slack/package.json packages/slack/
COPY packages/saas/package.json packages/saas/

COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/slack/dist ./packages/slack/dist
COPY --from=build /app/packages/saas/dist ./packages/saas/dist

COPY packages/core/src/db/schema.ts packages/core/src/db/
COPY packages/core/drizzle.config.ts packages/core/

COPY packages/saas/src/db/schema.ts packages/saas/src/db/
COPY packages/saas/drizzle.config.ts packages/saas/

COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
COPY scripts/init-db.sql /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint.sh

RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client bash && rm -rf /var/lib/apt/lists/*

RUN addgroup --system lock && adduser --system --ingroup lock lock
USER lock

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
