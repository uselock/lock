import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, seedTestData, cleanupTestData, closePool, type TestSeed } from './setup.js';

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('Core API e2e', () => {
  let app: FastifyInstance;
  let seed: TestSeed;

  // State shared across sequential tests
  let createdProductSlug: string;
  let createdFeatureSlug: string;
  let createdLockShortId: string;
  let revertedLockShortId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    seed = await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData(seed.workspaceId);
    await app.close();
    await closePool();
  });

  // --- Health ---

  it('health check returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  // --- Auth ---

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/products' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  // --- Products ---

  it('creates a product', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: { authorization: seed.authHeader },
      payload: { slug: 'test-trading', name: 'Test Trading' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.slug).toBe('test-trading');
    expect(body.data.name).toBe('Test Trading');
    createdProductSlug = body.data.slug;
  });

  it('rejects duplicate product', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: { authorization: seed.authHeader },
      payload: { slug: createdProductSlug, name: 'Dup' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('PRODUCT_EXISTS');
  });

  it('lists products with lock_count', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
      headers: { authorization: seed.authHeader },
    });
    expect(res.statusCode).toBe(200);
    const products = res.json().data.products;
    expect(Array.isArray(products)).toBe(true);
    const found = products.find((p: any) => p.slug === createdProductSlug);
    expect(found).toBeDefined();
    expect(typeof found.lock_count).toBe('number');
  });

  it('updates product description', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/products/${createdProductSlug}`,
      headers: { authorization: seed.authHeader },
      payload: { description: 'Updated description' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.description).toBe('Updated description');
  });

  // --- Features ---

  it('creates a feature', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/features',
      headers: { authorization: seed.authHeader },
      payload: { slug: 'test-cache', name: 'Test Cache', product: createdProductSlug },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.slug).toBe('test-cache');
    expect(body.data.product.slug).toBe(createdProductSlug);
    createdFeatureSlug = body.data.slug;
  });

  it('lists features filtered by product', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/features?product=${createdProductSlug}`,
      headers: { authorization: seed.authHeader },
    });
    expect(res.statusCode).toBe(200);
    const feats = res.json().data.features;
    expect(Array.isArray(feats)).toBe(true);
    expect(feats.some((f: any) => f.slug === createdFeatureSlug)).toBe(true);
  });

  // --- Locks ---

  it('commits a lock', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/locks',
      headers: { authorization: seed.authHeader },
      payload: {
        message: 'Use Redis for caching',
        product: createdProductSlug,
        feature: createdFeatureSlug,
        scope: 'major',
        tags: ['cache', 'infra'],
        author: { type: 'human', id: 'test-user', name: 'tester', source: 'api' },
        source: { type: 'api', ref: 'test-suite' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.lock.short_id).toMatch(/^l-[0-9a-f]{6}$/);
    expect(body.data.lock.status).toBe('active');
    expect(body.data.lock.message).toBe('Use Redis for caching');
    createdLockShortId = body.data.lock.short_id;
  });

  it('rejects lock commit with missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/locks',
      headers: { authorization: seed.authHeader },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('lists locks', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/locks',
      headers: { authorization: seed.authHeader },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(Array.isArray(data.locks)).toBe(true);
    expect(data.locks.some((l: any) => l.short_id === createdLockShortId)).toBe(true);
  });

  it('lists locks filtered by product', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/locks?product=${createdProductSlug}`,
      headers: { authorization: seed.authHeader },
    });
    expect(res.statusCode).toBe(200);
    const locks = res.json().data.locks;
    expect(locks.every((l: any) => l.product?.slug === createdProductSlug)).toBe(true);
  });

  it('gets a single lock by short_id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/locks/${createdLockShortId}`,
      headers: { authorization: seed.authHeader },
    });
    expect(res.statusCode).toBe(200);
    const lock = res.json().data.lock;
    expect(lock.short_id).toBe(createdLockShortId);
    expect(lock.message).toBe('Use Redis for caching');
    expect(lock.product.slug).toBe(createdProductSlug);
    expect(lock.feature.slug).toBe(createdFeatureSlug);
  });

  it('returns 404 for non-existent lock', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/locks/l-000000',
      headers: { authorization: seed.authHeader },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('LOCK_NOT_FOUND');
  });

  // --- Update lock scope ---

  it('updates lock scope', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/locks/${createdLockShortId}`,
      headers: { authorization: seed.authHeader },
      payload: { scope: 'architectural' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.lock.scope).toBe('architectural');
  });

  it('rejects update with no fields', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/locks/${createdLockShortId}`,
      headers: { authorization: seed.authHeader },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  // --- Links ---

  it('adds a link to a lock', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/locks/${createdLockShortId}/link`,
      headers: { authorization: seed.authHeader },
      payload: { link_type: 'jira', link_ref: 'TRADE-123' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.link.type).toBe('jira');
    expect(res.json().data.link.ref).toBe('TRADE-123');
  });

  // --- Revert ---

  it('reverts a lock', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/locks/${createdLockShortId}/revert`,
      headers: { authorization: seed.authHeader },
      payload: {
        message: 'Reverting Redis decision',
        author: { type: 'human', id: 'test-user', name: 'tester', source: 'api' },
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.reverted.short_id).toBe(createdLockShortId);
    expect(data.reverted.status).toBe('reverted');
    expect(data.revert_lock.short_id).toMatch(/^l-[0-9a-f]{6}$/);
    revertedLockShortId = createdLockShortId;
  });

  it('cannot revert an already-reverted lock', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/locks/${revertedLockShortId}/revert`,
      headers: { authorization: seed.authHeader },
      payload: {
        message: 'Double revert',
        author: { type: 'human', id: 'test-user', name: 'tester', source: 'api' },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  // --- Decision type ---

  it('commits a lock with explicit decision_type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/locks',
      headers: { authorization: seed.authHeader },
      payload: {
        message: 'Use WebSocket for real-time updates',
        product: createdProductSlug,
        feature: createdFeatureSlug,
        scope: 'major',
        decision_type: 'technical',
        tags: ['realtime'],
        author: { type: 'human', id: 'test-user', name: 'tester', source: 'api' },
        source: { type: 'api', ref: 'test-suite' },
      },
    });
    expect(res.statusCode).toBe(201);
    const lock = res.json().data.lock;
    expect(lock.decision_type).toBe('technical');
  });

  it('filters locks by decision_type', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/locks?decision_type=technical`,
      headers: { authorization: seed.authHeader },
    });
    expect(res.statusCode).toBe(200);
    const locks = res.json().data.locks;
    expect(Array.isArray(locks)).toBe(true);
    expect(locks.every((l: any) => l.decision_type === 'technical')).toBe(true);
  });

  it('PATCHes decision_type on a lock', async () => {
    // First create a fresh lock to update
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/locks',
      headers: { authorization: seed.authHeader },
      payload: {
        message: 'Use dark theme as default',
        product: createdProductSlug,
        feature: createdFeatureSlug,
        scope: 'minor',
        decision_type: 'design',
        author: { type: 'human', id: 'test-user', name: 'tester', source: 'api' },
        source: { type: 'api', ref: 'test-suite' },
      },
    });
    const shortId = createRes.json().data.lock.short_id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/locks/${shortId}`,
      headers: { authorization: seed.authHeader },
      payload: { decision_type: 'business' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.lock.decision_type).toBe('business');
  });

  it('rejects invalid decision_type', async () => {
    // Create another fresh lock
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/locks',
      headers: { authorization: seed.authHeader },
      payload: {
        message: 'Temp lock for validation test',
        product: createdProductSlug,
        feature: createdFeatureSlug,
        author: { type: 'human', id: 'test-user', name: 'tester', source: 'api' },
        source: { type: 'api', ref: 'test-suite' },
      },
    });
    const shortId = createRes.json().data.lock.short_id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/locks/${shortId}`,
      headers: { authorization: seed.authHeader },
      payload: { decision_type: 'invalid_type' },
    });
    expect(res.statusCode).toBe(400);
  });

  // --- Recap ---

  it('returns a recap summary', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/locks/recap',
      headers: { authorization: seed.authHeader },
    });
    expect(res.statusCode).toBe(200);
    const recap = res.json().data;
    expect(recap.period).toBeDefined();
    expect(recap.summary).toBeDefined();
    expect(typeof recap.summary.total_decisions).toBe('number');
    expect(recap.decisions).toBeDefined();
    expect(recap.top_contributors).toBeDefined();
  });

  it('returns recap filtered by product', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/locks/recap?product=${createdProductSlug}`,
      headers: { authorization: seed.authHeader },
    });
    expect(res.statusCode).toBe(200);
    const recap = res.json().data;
    expect(recap.summary.total_decisions).toBeGreaterThanOrEqual(0);
  });

  // --- Channel configs ---

  it('creates a channel config', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/channel-configs',
      headers: { authorization: seed.authHeader },
      payload: {
        slack_channel_id: 'C_TEST_123',
        product: createdProductSlug,
        feature: createdFeatureSlug,
      },
    });
    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.product.slug).toBe(createdProductSlug);
    expect(data.feature.slug).toBe(createdFeatureSlug);
  });

  it('gets a channel config', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/channel-configs/C_TEST_123',
      headers: { authorization: seed.authHeader },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.slack_channel_id).toBe('C_TEST_123');
  });

  it('returns 404 for non-existent channel config', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/channel-configs/C_NOPE',
      headers: { authorization: seed.authHeader },
    });
    expect(res.statusCode).toBe(404);
  });
});
