import type { FastifyInstance } from 'fastify';
import {
  commitLock,
  listLocks,
  getLock,
  revertLock,
  addLink,
  searchLocks,
  updateLockMetadata,
  getRecap,
} from '../services/lock-service.js';
import { extractFromThread, extractBatchDecisions, type ExtractRequest } from '../services/extract-service.js';
import { preCheckConflicts } from '../services/conflict-service.js';
import { getLineage } from '../services/lineage-service.js';
import type {
  CreateLockRequest,
  RevertLockRequest,
  AddLinkRequest,
  SearchLocksRequest,
  ListLocksQuery,
} from '../types.js';
import { VALID_DECISION_TYPES } from '../types.js';
import { trackEvent } from '../lib/hooks.js';

export async function lockRoutes(fastify: FastifyInstance) {
  // Commit a new lock
  fastify.post('/', async (request, reply) => {
    const body = request.body as CreateLockRequest;

    if (!body.message || !body.product || !body.author || !body.source) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'message, product, author, and source are required' },
      });
    }

    try {
      const result = await commitLock(request.workspaceId, body);
      trackEvent(request.workspaceId, 'lock_committed', {
        product: body.product,
        feature: body.feature ?? 'main',
        scope: body.scope ?? 'minor',
        source: body.source?.type,
        author_type: body.author?.type,
        has_conflicts: (result.conflicts?.length ?? 0) > 0,
        supersession_detected: result.supersession?.detected ?? false,
      });
      return reply.status(201).send({ data: result });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: { code: 'COMMIT_FAILED', message: err.message },
      });
    }
  });

  // List/filter locks
  fastify.get('/', async (request) => {
    const query = request.query as ListLocksQuery;
    const result = await listLocks(request.workspaceId, query);
    return { data: result };
  });

  const llmRateLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  // Extract a decision from thread context (LLM-powered)
  fastify.post('/extract', llmRateLimit, async (request, reply) => {
    const body = request.body as ExtractRequest;

    if (!body.thread_context) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'thread_context is required' },
      });
    }

    try {
      const result = await extractFromThread(body);
      trackEvent(request.workspaceId, 'lock_extracted', {
        has_hint: !!body.user_hint,
        product: body.product,
        feature: body.feature,
        confidence: result.confidence,
      });
      return { data: result };
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: { code: 'EXTRACTION_FAILED', message: err.message },
      });
    }
  });

  // Search locks
  fastify.post('/search', llmRateLimit, async (request) => {
    const body = request.body as SearchLocksRequest;
    const result = await searchLocks(request.workspaceId, body);
    trackEvent(request.workspaceId, 'lock_searched', {
      product: body.product,
      feature: body.feature,
      result_count: result.locks?.length ?? 0,
    });
    return { data: result };
  });

  // Recap — aggregated summary of recent decisions
  fastify.get('/recap', async (request) => {
    const query = request.query as { product?: string; since?: string; limit?: string };
    const result = await getRecap(request.workspaceId, {
      product: query.product,
      since: query.since,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
    return { data: result };
  });

  // Batch extraction from message history
  fastify.post('/extract-batch', llmRateLimit, async (request, reply) => {
    const body = request.body as { messages: { text: string; author: string; timestamp: string }[]; product?: string; feature?: string };

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'messages array is required and must not be empty' },
      });
    }

    try {
      const result = await extractBatchDecisions(body);
      return { data: result };
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: { code: 'EXTRACTION_FAILED', message: err.message },
      });
    }
  });

  // Pre-check for conflicts before committing
  fastify.post('/pre-check', llmRateLimit, async (request, reply) => {
    const body = request.body as { message: string; product: string; feature: string; scope?: string };

    if (!body.message || !body.product) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'message and product are required' },
      });
    }

    try {
      const result = await preCheckConflicts(
        request.workspaceId,
        body.message,
        body.product,
        body.feature || 'main',
        body.scope ?? 'minor',
      );
      return { data: result };
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: { code: 'PRE_CHECK_FAILED', message: err.message },
      });
    }
  });

  // Get a single lock
  fastify.get('/:shortId', async (request, reply) => {
    const { shortId } = request.params as { shortId: string };
    const lock = await getLock(request.workspaceId, shortId);
    if (!lock) {
      return reply.status(404).send({
        error: { code: 'LOCK_NOT_FOUND', message: `Lock "${shortId}" not found` },
      });
    }
    return { data: { lock } };
  });

  // Update lock metadata (scope, tags, decision_type)
  fastify.patch('/:shortId', async (request, reply) => {
    const { shortId } = request.params as { shortId: string };
    const body = request.body as { scope?: string; tags?: string[]; decision_type?: string };

    if (!body.scope && !body.tags && !body.decision_type) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'At least one of scope, tags, or decision_type is required' },
      });
    }

    if (body.decision_type && !VALID_DECISION_TYPES.includes(body.decision_type as any)) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: `Invalid decision_type. Must be one of: ${VALID_DECISION_TYPES.join(', ')}` },
      });
    }

    try {
      const result = await updateLockMetadata(request.workspaceId, shortId, {
        scope: body.scope as any,
        tags: body.tags,
        decision_type: body.decision_type as any,
      });
      if (!result) {
        return reply.status(404).send({
          error: { code: 'LOCK_NOT_FOUND', message: `Lock "${shortId}" not found` },
        });
      }
      return { data: { lock: result } };
    } catch (err: any) {
      return reply.status(400).send({
        error: { code: 'UPDATE_FAILED', message: err.message },
      });
    }
  });

  // Get lock lineage
  fastify.get('/:shortId/lineage', async (request, reply) => {
    const { shortId } = request.params as { shortId: string };
    const lock = await getLock(request.workspaceId, shortId);
    if (!lock) {
      return reply.status(404).send({
        error: { code: 'LOCK_NOT_FOUND', message: `Lock "${shortId}" not found` },
      });
    }
    const chain = await getLineage(request.workspaceId, lock.id);
    return { data: { chain } };
  });

  // Revert a lock
  fastify.post('/:shortId/revert', async (request, reply) => {
    const { shortId } = request.params as { shortId: string };
    const body = request.body as RevertLockRequest;

    if (!body.message || !body.author) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'message and author are required' },
      });
    }

    try {
      const result = await revertLock(request.workspaceId, shortId, body);
      if (!result) {
        return reply.status(404).send({
          error: { code: 'LOCK_NOT_FOUND', message: `Lock "${shortId}" not found` },
        });
      }
      trackEvent(request.workspaceId, 'lock_reverted', {
        short_id: shortId,
        author_type: body.author?.type,
      });
      return { data: result };
    } catch (err: any) {
      return reply.status(400).send({
        error: { code: 'REVERT_FAILED', message: err.message },
      });
    }
  });

  // Add a link to a lock
  fastify.post('/:shortId/link', async (request, reply) => {
    const { shortId } = request.params as { shortId: string };
    const body = request.body as AddLinkRequest;

    if (!body.link_type || !body.link_ref) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'link_type and link_ref are required' },
      });
    }

    const result = await addLink(request.workspaceId, shortId, body);
    if (!result) {
      return reply.status(404).send({
        error: { code: 'LOCK_NOT_FOUND', message: `Lock "${shortId}" not found` },
      });
    }

    trackEvent(request.workspaceId, 'lock_link_added', {
      short_id: shortId,
      link_type: body.link_type,
    });
    return reply.status(201).send({ data: { link: result } });
  });
}
