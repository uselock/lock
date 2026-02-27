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
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Internal service-to-service auth
  const internalSecret = request.headers['x-internal-secret'] as string | undefined;
  const expectedSecret = process.env.INTERNAL_SECRET;
  if (internalSecret && expectedSecret && timingSafeCompare(internalSecret, expectedSecret)) {
    // Resolve workspace from Slack team ID header
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
      error: { code: 'MISSING_TEAM_ID', message: 'X-Workspace-Team-Id header required for internal auth' },
    });
  }

  // Bearer token auth
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
    });
  }

  const token = authHeader.slice(7);
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
