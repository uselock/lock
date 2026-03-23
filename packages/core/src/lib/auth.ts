import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';
import { apiKeys, workspaces } from '../db/schema.js';

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self to keep constant time, then return false
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

declare module 'fastify' {
  interface FastifyRequest {
    workspaceId: string;
    userId?: string;
    userRole?: string;
  }
}

/**
 * Auth strategy function. Return true if auth was handled (success or failure).
 * Return false to fall through to the next strategy.
 */
export type AuthStrategy = (request: FastifyRequest, reply: FastifyReply) => Promise<boolean>;

const authStrategies: AuthStrategy[] = [];

/** Register an additional auth strategy (e.g., session cookies, JWT). Called by SaaS plugin. */
export function registerAuthStrategy(strategy: AuthStrategy): void {
  authStrategies.push(strategy);
}

/** Clear all registered auth strategies (useful for testing). */
export function clearAuthStrategies(): void {
  authStrategies.length = 0;
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 1. Internal service-to-service auth
  const internalSecret = request.headers['x-internal-secret'] as string | undefined;
  const expectedSecret = process.env.INTERNAL_SECRET;
  if (internalSecret && expectedSecret && timingSafeCompare(internalSecret, expectedSecret)) {
    // Resolve workspace from direct workspace ID (SaaS services) or Slack team ID (Slack bot)
    const workspaceId = request.headers['x-workspace-id'] as string | undefined;
    if (workspaceId) {
      request.workspaceId = workspaceId;
      return;
    }

    const teamId = request.headers['x-workspace-team-id'] as string | undefined;
    if (teamId) {
      let workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.slackTeamId, teamId),
      });
      if (!workspace) {
        const [created] = await db
          .insert(workspaces)
          .values({ slackTeamId: teamId, name: `Workspace ${teamId}` })
          .returning();
        workspace = created;
      }
      request.workspaceId = workspace.id;
      return;
    }
    return reply.status(400).send({
      error: { code: 'MISSING_WORKSPACE', message: 'X-Workspace-Id or X-Workspace-Team-Id header required for internal auth' },
    });
  }

  // 2. Registered auth strategies (e.g., session cookies, JWT from SaaS plugin)
  for (const strategy of authStrategies) {
    const handled = await strategy(request, reply);
    if (handled) return;
  }

  // 3. Bearer token auth (API key)
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
    });
  }

  const token = authHeader.slice(7);

  // API key auth (lk_ prefix)
  const keyHash = crypto.createHash('sha256').update(token).digest('hex');

  const key = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, keyHash),
  });

  if (!key) {
    return reply.status(401).send({
      error: { code: 'INVALID_API_KEY', message: 'Invalid API key' },
    });
  }

  // Update last_used_at
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id));

  request.workspaceId = key.workspaceId;
}
