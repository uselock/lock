import crypto from 'crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from '../routes/health.js';
import { lockRoutes } from '../routes/locks.js';
import { productRoutes } from '../routes/products.js';
import { featureRoutes } from '../routes/features.js';
import { channelConfigRoutes } from '../routes/channel-configs.js';
import { authMiddleware } from '../lib/auth.js';
import { db, pool } from '../db/client.js';
import { workspaces, apiKeys, products, features, locks, lockLinks, channelConfigs } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });

  // Health — no auth
  await app.register(healthRoutes);

  // API routes — with auth
  await app.register(
    async (api) => {
      api.addHook('preHandler', authMiddleware);

      await api.register(lockRoutes, { prefix: '/locks' });
      await api.register(productRoutes, { prefix: '/products' });
      await api.register(featureRoutes, { prefix: '/features' });
      await api.register(channelConfigRoutes, { prefix: '/channel-configs' });
    },
    { prefix: '/api/v1' }
  );

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    reply.status(error.statusCode ?? 500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
    });
  });

  await app.ready();
  return app;
}

export interface TestSeed {
  workspaceId: string;
  apiKey: string;
  authHeader: string;
}

export async function seedTestData(): Promise<TestSeed> {
  // Create workspace
  const [workspace] = await db
    .insert(workspaces)
    .values({ name: 'Test Workspace' })
    .returning();

  // Create API key
  const rawKey = `lk_test_${crypto.randomBytes(16).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  await db.insert(apiKeys).values({
    workspaceId: workspace.id,
    keyHash,
    keyPrefix: rawKey.slice(0, 8),
    name: 'test-key',
  });

  return {
    workspaceId: workspace.id,
    apiKey: rawKey,
    authHeader: `Bearer ${rawKey}`,
  };
}

export async function cleanupTestData(workspaceId: string): Promise<void> {
  // Delete in order respecting foreign keys
  await db.delete(lockLinks).where(
    eq(lockLinks.lockId, lockLinks.lockId) // will be scoped by subquery below
  );

  // Delete lock_links for locks in this workspace
  const workspaceLocks = await db.query.locks.findMany({
    where: eq(locks.workspaceId, workspaceId),
  });
  for (const lock of workspaceLocks) {
    await db.delete(lockLinks).where(eq(lockLinks.lockId, lock.id));
  }

  await db.delete(channelConfigs).where(eq(channelConfigs.workspaceId, workspaceId));
  await db.delete(locks).where(eq(locks.workspaceId, workspaceId));

  const workspaceProducts = await db.query.products.findMany({
    where: eq(products.workspaceId, workspaceId),
  });
  for (const product of workspaceProducts) {
    await db.delete(features).where(eq(features.productId, product.id));
  }

  await db.delete(products).where(eq(products.workspaceId, workspaceId));
  await db.delete(apiKeys).where(eq(apiKeys.workspaceId, workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
}

export async function closePool(): Promise<void> {
  await pool.end();
}
