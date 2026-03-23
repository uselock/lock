#!/usr/bin/env bash
set -euo pipefail

# Sync open-source Lock files to a public repo checkout
# Usage: ./scripts/sync-public.sh /path/to/public-repo

TARGET="${1:?Usage: sync-public.sh <target-directory>}"
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"

echo "Syncing open-source files..."
echo "  Source: $SOURCE"
echo "  Target: $TARGET"

mkdir -p "$TARGET"

rsync -av --delete \
  --exclude='.git/' \
  --exclude='packages/saas/' \
  --exclude='packages/web/' \
  --exclude='.github/' \
  --exclude='packages/cli/src/commands/signup.ts' \
  --exclude='packages/cli/src/lib/device-flow.ts' \
  --exclude='packages/cli/src/templates/' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='.env' \
  --exclude='.DS_Store' \
  --exclude='public-repo/' \
  "$SOURCE/" "$TARGET/"

echo ""
echo "Stripping private sections from CLAUDE.md..."
# Remove the "Repo Structure: Open-Source Core + Private SaaS" section
# It sits between two "---" markers after the project intro
sed -i.bak '/^## ⚠️ Repo Structure/,/^---$/d' "$TARGET/CLAUDE.md"
rm -f "$TARGET/CLAUDE.md.bak"

echo "Stripping SaaS-only variables from .env.example..."
# Remove SaaS-only sections: Stripe, PostHog, Resend, Google OAuth, Slack OAuth
sed -i.bak \
  -e '/^# ── Hosted SaaS/,$ d' \
  -e '/^# PostHog/,/^$/ d' \
  -e '/^POSTHOG_/d' \
  "$TARGET/.env.example"
rm -f "$TARGET/.env.example.bak"

echo "Verifying no SaaS imports leaked..."

LEAKED=0
# Check for imports that should only exist in saas package
for pattern in "billing-service" "user-service" "email-service" "usage-service" "./jwt" "bcryptjs" "stripe" "@fastify/cookie" "posthog-node" "posthog"; do
  # Search for actual imports/requires in core (not comments)
  if grep -rn "import.*$pattern\|require.*$pattern" "$TARGET/packages/core/src/" 2>/dev/null | grep -v "node_modules" | grep -v ".d.ts" > /dev/null 2>&1; then
    echo "  WARNING: Found '$pattern' in core package"
    LEAKED=1
  fi
done

if grep -q "private monorepo\|packages/saas\|packages/web\|lock-private\|sync-public" "$TARGET/CLAUDE.md" 2>/dev/null; then
  echo "  WARNING: CLAUDE.md still contains private references"
  LEAKED=1
fi

if [ "$LEAKED" -eq 0 ]; then
  echo "  No SaaS imports or private references found. Clean!"
else
  echo ""
  echo "  Some SaaS/private references found — these should be removed before publishing."
fi

echo ""
echo "Sync complete. Review changes at: $TARGET"
