import type { FastifyInstance } from 'fastify';
import {
  commitLock,
  listLocks,
  getLock,
  revertLock,
  addLink,
  searchLocks,
  updateLockMetadata,
} from '../services/lock-service.js';
import { extractFromThread, type ExtractRequest } from '../services/extract-service.js';
import { getLineage } from '../services/lineage-service.js';
import type {
  CreateLockRequest,
  RevertLockRequest,
  AddLinkRequest,
  SearchLocksRequest,
  ListLocksQuery,
} from '../types.js';

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

  // Update lock metadata (scope, tags)
  fastify.patch('/:shortId', async (request, reply) => {
    const { shortId } = request.params as { shortId: string };
    const body = request.body as { scope?: string; tags?: string[] };

    if (!body.scope && !body.tags) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'At least one of scope or tags is required' },
      });
    }

    try {
      const result = await updateLockMetadata(shortId, {
        scope: body.scope as any,
        tags: body.tags,
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
