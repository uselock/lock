import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { locks } from '../db/schema.js';

interface LineageNode {
  short_id: string;
  message: string;
  status: string;
  scope: string;
  created_at: Date | null;
  relationship: 'supersedes' | 'superseded_by' | 'reverted_by' | 'root';
}

export async function getLineage(workspaceId: string, lockId: string): Promise<LineageNode[]> {
  const chain: LineageNode[] = [];
  const visited = new Set<string>();

  // Walk backwards through supersession chain
  let currentId: string | null = lockId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const lock: typeof locks.$inferSelect | undefined = await db.query.locks.findFirst({
      where: and(eq(locks.workspaceId, workspaceId), eq(locks.id, currentId)),
    });
    if (!lock) break;

    chain.unshift({
      short_id: lock.shortId,
      message: lock.message,
      status: lock.status,
      scope: lock.scope,
      created_at: lock.createdAt,
      relationship: currentId === lockId ? 'root' : 'supersedes',
    });

    currentId = lock.supersedesId;
  }

  // Walk forwards through supersession chain
  const rootLock = await db.query.locks.findFirst({
    where: and(eq(locks.workspaceId, workspaceId), eq(locks.id, lockId)),
  });
  if (rootLock) {
    let forwardId: string | null = rootLock.supersededById;
    while (forwardId && !visited.has(forwardId)) {
      visited.add(forwardId);
      const lock = await db.query.locks.findFirst({
        where: and(eq(locks.workspaceId, workspaceId), eq(locks.id, forwardId)),
      });
      if (!lock) break;

      chain.push({
        short_id: lock.shortId,
        message: lock.message,
        status: lock.status,
        scope: lock.scope,
        created_at: lock.createdAt,
        relationship: 'superseded_by',
      });

      forwardId = lock.supersededById;
    }

    // Add revert info if present
    if (rootLock.revertedById && !visited.has(rootLock.revertedById)) {
      const revertLock = await db.query.locks.findFirst({
        where: and(eq(locks.workspaceId, workspaceId), eq(locks.id, rootLock.revertedById)),
      });
      if (revertLock) {
        chain.push({
          short_id: revertLock.shortId,
          message: revertLock.message,
          status: revertLock.status,
          scope: revertLock.scope,
          created_at: revertLock.createdAt,
          relationship: 'reverted_by',
        });
      }
    }
  }

  return chain;
}
