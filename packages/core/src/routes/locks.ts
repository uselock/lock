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

export async function lockRoutes(fastify: FastifyInstance) {
  // Commit a new lock
  fastify.post('/', async (request, reply) => {
    const body = request.body as CreateLockRequest;

    if (!body.message || !body.product || !body.feature || !body.author || !body.source) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'message, product, feature, author, and source are required' },
      });
    }

    try {
      const result = await commitLock(request.workspaceId, body);
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

  // Extract a decision from thread context (LLM-powered)
  fastify.post('/extract', async (request, reply) => {
    const body = request.body as ExtractRequest;

    if (!body.thread_context) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'thread_context is required' },
      });
    }

    try {
      const result = await extractFromThread(body);
      return { data: result };
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: { code: 'EXTRACTION_FAILED', message: err.message },
      });
    }
  });

  // Search locks
  fastify.post('/search', async (request) => {
    const body = request.body as SearchLocksRequest;
    const result = await searchLocks(request.workspaceId, body);
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
  fastify.post('/extract-batch', async (request, reply) => {
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
  fastify.post('/pre-check', async (request, reply) => {
    const body = request.body as { message: string; product: string; feature: string; scope?: string };

    if (!body.message || !body.product || !body.feature) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'message, product, and feature are required' },
      });
    }

    try {
      const result = await preCheckConflicts(
        request.workspaceId,
        body.message,
        body.product,
        body.feature,
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
    const lock = await getLock(shortId);
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
      const result = await updateLockMetadata(shortId, {
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
    const lock = await getLock(shortId);
    if (!lock) {
      return reply.status(404).send({
        error: { code: 'LOCK_NOT_FOUND', message: `Lock "${shortId}" not found` },
      });
    }
    const chain = await getLineage(lock.id);
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

    const result = await addLink(shortId, body);
    if (!result) {
      return reply.status(404).send({
        error: { code: 'LOCK_NOT_FOUND', message: `Lock "${shortId}" not found` },
      });
    }

    return reply.status(201).send({ data: { link: result } });
  });
}
