import { WebClient } from '@slack/web-api';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { channelConfigs } from '../db/schema.js';
import { getSlackTokenProvider } from '../lib/hooks.js';

let defaultSlackClient: WebClient | null = null;

// Per-workspace client cache with TTL to handle token rotation gracefully.
// Short TTL ensures stale tokens are evicted without requiring explicit invalidation.
const CACHE_TTL = 300_000; // 5 minutes
const workspaceClientCache = new Map<string, { client: WebClient; expires: number }>();

function getDefaultSlackClient(): WebClient | null {
  if (!process.env.SLACK_BOT_TOKEN) return null;
  if (!defaultSlackClient) {
    defaultSlackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
  }
  return defaultSlackClient;
}

async function resolveSlackClient(workspaceId?: string): Promise<WebClient | null> {
  // Try per-workspace token provider first (SaaS multi-tenant)
  if (workspaceId) {
    const provider = getSlackTokenProvider();
    if (provider) {
      const cached = workspaceClientCache.get(workspaceId);
      if (cached && cached.expires > Date.now()) {
        return cached.client;
      }

      const token = await provider(workspaceId);
      if (token) {
        const client = new WebClient(token);
        workspaceClientCache.set(workspaceId, { client, expires: Date.now() + CACHE_TTL });
        return client;
      }
      // Token not found (workspace disconnected) — evict stale entry
      workspaceClientCache.delete(workspaceId);
    }
  }
  // Fall back to env var (self-hosted single-tenant)
  return getDefaultSlackClient();
}

export async function notifySlack(lock: {
  shortId: string;
  message: string;
  authorName: string;
  authorSource: string;
  featureId: string;
  workspaceId?: string;
}): Promise<void> {
  const client = await resolveSlackClient(lock.workspaceId);
  if (!client) return;

  const config = await db.query.channelConfigs.findFirst({
    where: eq(channelConfigs.featureId, lock.featureId),
  });

  if (!config) return;

  await client.chat.postMessage({
    channel: config.slackChannelId,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔒 *New lock from ${lock.authorSource}* (\`${lock.shortId}\`)\n> "${lock.message}"\n_Author: ${lock.authorName} via ${lock.authorSource}_`,
        },
      },
    ],
    text: `New lock: ${lock.message}`,
  });
}
