#!/bin/sh
set -e

echo "Lock: waiting for PostgreSQL..."
until pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USER:-lock}" -q; do
  sleep 1
done
echo "Lock: PostgreSQL is ready."

echo "Lock: pushing database schema..."
cd /app/packages/core
npx drizzle-kit push --force 2>&1
cd /app
echo "Lock: schema push complete."

echo "Lock: starting services..."

# Start core API
node /app/packages/core/dist/index.js &
CORE_PID=$!

# Start Slack bot
node /app/packages/slack/dist/index.js &
SLACK_PID=$!

# Forward signals to child processes
trap 'kill $CORE_PID $SLACK_PID 2>/dev/null; wait $CORE_PID $SLACK_PID 2>/dev/null' SIGTERM SIGINT

# Wait for both processes
wait $CORE_PID $SLACK_PID
