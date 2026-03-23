import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, seedTestData, cleanupTestData, closePool, type TestSeed } from './setup.js';
import { db } from '../db/client.js';
import { workspaces } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const hasDb = !!process.env.DATABASE_URL;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'change-me-to-a-random-string';

describe.skipIf(!hasDb)('Internal service auth (X-Internal-Secret)', () => {
  let app: FastifyInstance;
  let seed: TestSeed;
  let secondWorkspaceId: string;

  beforeAll(async () => {
    // Ensure INTERNAL_SECRET is set for tests
    process.env.INTERNAL_SECRET = INTERNAL_SECRET;
    app = await buildTestApp();
    seed = await seedTestData();

    // Create a second workspace for isolation tests
    const [ws2] = await db
      .insert(workspaces)
      .values({ name: 'Second Workspace' })
      .returning();
    secondWorkspaceId = ws2.id;
  });

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, secondWorkspaceId));
    await cleanupTestData(seed.workspaceId);
    await app.close();
    await closePool();
  });

  // --- X-Workspace-Id (direct UUID) ---

  it('accepts X-Internal-Secret + X-Workspace-Id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
      headers: {
        'x-internal-secret': INTERNAL_SECRET,
        'x-workspace-id': seed.workspaceId,
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('scopes data to the provided workspace ID', async () => {
    // Create product in workspace 1 via API key
    await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: { authorization: seed.authHeader },
      payload: { slug: 'internal-auth-test', name: 'Internal Auth Test' },
    });

    // Query workspace 2 via internal auth — should NOT see workspace 1's products
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
      headers: {
        'x-internal-secret': INTERNAL_SECRET,
        'x-workspace-id': secondWorkspaceId,
      },
    });
    expect(res.statusCode).toBe(200);
    const products = res.json().data.products;
    const leaked = products.find((p: any) => p.slug === 'internal-auth-test');
    expect(leaked).toBeUndefined();
  });

  // --- X-Workspace-Team-Id (Slack team ID, auto-upsert) ---

  it('accepts X-Internal-Secret + X-Workspace-Team-Id and auto-creates workspace', async () => {
    const teamId = `T_test_${Date.now()}`;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
      headers: {
        'x-internal-secret': INTERNAL_SECRET,
        'x-workspace-team-id': teamId,
      },
    });
    expect(res.statusCode).toBe(200);

    // Verify workspace was created
    const ws = await db.query.workspaces.findFirst({
      where: eq(workspaces.slackTeamId, teamId),
    });
    expect(ws).toBeDefined();
    expect(ws!.name).toContain(teamId);

    // Cleanup
    await db.delete(workspaces).where(eq(workspaces.id, ws!.id));
  });

  // --- Error cases ---

  it('rejects invalid X-Internal-Secret', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
      headers: {
        'x-internal-secret': 'wrong-secret',
        'x-workspace-id': seed.workspaceId,
      },
    });
    // Falls through to bearer token auth, gets 401
    expect(res.statusCode).toBe(401);
  });

  it('rejects missing workspace header after valid secret', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
      headers: {
        'x-internal-secret': INTERNAL_SECRET,
        // No X-Workspace-Id or X-Workspace-Team-Id
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('MISSING_WORKSPACE');
  });

  it('prefers X-Workspace-Id over X-Workspace-Team-Id when both present', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
      headers: {
        'x-internal-secret': INTERNAL_SECRET,
        'x-workspace-id': seed.workspaceId,
        'x-workspace-team-id': 'T_should_be_ignored',
      },
    });
    expect(res.statusCode).toBe(200);
    // If X-Workspace-Team-Id were used, it would auto-create a new workspace
    // Verify no workspace was created for the team ID
    const ws = await db.query.workspaces.findFirst({
      where: eq(workspaces.slackTeamId, 'T_should_be_ignored'),
    });
    expect(ws).toBeUndefined();
  });
});
