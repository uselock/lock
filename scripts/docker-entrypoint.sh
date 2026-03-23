#!/bin/bash
set -e

# Determine which mode to run: saas (default if saas dist exists) or core+slack
if [ -f /app/packages/saas/dist/index.js ]; then
  MODE="saas"
else
  MODE="core"
fi

# Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Lock: ERROR — DATABASE_URL is not set. Check Railway variables."
  exit 1
fi

# Parse DATABASE_URL for pg_isready
DB_HOST_PARSED=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
DB_PORT_PARSED=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
PG_HOST="${DB_HOST_PARSED:-localhost}"
PG_PORT="${DB_PORT_PARSED:-5432}"

echo "Lock: waiting for PostgreSQL at ${PG_HOST}:${PG_PORT}..."
until pg_isready -h "$PG_HOST" -p "$PG_PORT" -q 2>/dev/null; do
  sleep 1
done
echo "Lock: PostgreSQL is ready."

echo "Lock: enabling PostgreSQL extensions..."
psql "$DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS vector;' 2>&1 || echo "Lock: WARNING — could not enable vector extension."
psql "$DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";' 2>&1 || echo "Lock: WARNING — could not enable pgcrypto extension."

# Check if schema already exists (skip push if tables are present, unless FORCE_SCHEMA_PUSH=1)
TABLES_EXIST=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>/dev/null | tr -d ' ')

if [ "$TABLES_EXIST" -gt 0 ] && [ "$FORCE_SCHEMA_PUSH" != "1" ]; then
  echo "Lock: schema already exists ($TABLES_EXIST tables). Skipping push. Set FORCE_SCHEMA_PUSH=1 to force."
else
  echo "Lock: pushing database schema..."
  if [ "$MODE" = "saas" ] && [ -f /app/packages/saas/drizzle.config.ts ]; then
    DRIZZLE_CONFIG="/app/packages/saas/drizzle.config.ts"
    cd /app/packages/saas
  else
    DRIZZLE_CONFIG="/app/packages/core/drizzle.config.ts"
    cd /app/packages/core
  fi
  DRIZZLE_OUTPUT=$(npx drizzle-kit push --force --config="$DRIZZLE_CONFIG" 2>&1)
  DRIZZLE_EXIT=$?
  echo "$DRIZZLE_OUTPUT"
  if [ $DRIZZLE_EXIT -ne 0 ] || echo "$DRIZZLE_OUTPUT" | grep -qi "error:"; then
    echo "Lock: ERROR — schema push failed (exit=$DRIZZLE_EXIT). Check database state."
    exit 1
  fi
  cd /app
  echo "Lock: schema push complete."
fi

echo "Lock: starting services (mode: $MODE)..."

if [ "$MODE" = "saas" ]; then
  node /app/packages/saas/dist/index.js &
  MAIN_PID=$!
  echo "Lock: SaaS API (PID $MAIN_PID) started."
else
  node /app/packages/core/dist/index.js &
  MAIN_PID=$!
  echo "Lock: Core API (PID $MAIN_PID) started."
fi

# Start Slack bot only if tokens are set AND not conflicting with main service
if [ -f /app/packages/slack/dist/index.js ] && [ -n "$SLACK_APP_TOKEN" ] && [ -n "$SLACK_BOT_TOKEN" ]; then
  sleep 3
  # Run in a subshell so a crash doesn't propagate to the main entrypoint
  (node /app/packages/slack/dist/index.js || echo "Lock: WARNING — Slack bot exited with code $?.") &
  SLACK_PID=$!
  echo "Lock: Slack bot (PID $SLACK_PID) started on port ${SLACK_PORT:-3001}."
fi

# Forward signals
cleanup() {
  kill "$MAIN_PID" ${SLACK_PID:+"$SLACK_PID"} 2>/dev/null
  wait "$MAIN_PID" ${SLACK_PID:+"$SLACK_PID"} 2>/dev/null
}
trap cleanup SIGTERM SIGINT

# Wait for main process
wait "$MAIN_PID"
EXIT_CODE=$?
echo "Lock: main process exited with code $EXIT_CODE"
cleanup
exit $EXIT_CODE
