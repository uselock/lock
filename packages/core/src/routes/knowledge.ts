import type { FastifyInstance } from 'fastify';
import { getKnowledge, regenerateKnowledge } from '../services/knowledge-service.js';
import { hasLLM } from '../lib/llm.js';

export async function knowledgeRoutes(fastify: FastifyInstance) {
  // Get knowledge for a product/feature (generates on-demand if missing)
  fastify.get('/', async (request, reply) => {
    const query = request.query as { product?: string; feature?: string };

    if (!query.product) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'product query parameter is required' },
      });
    }

    try {
      const result = await getKnowledge(request.workspaceId, query.product, query.feature);
      if (!result) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Product or feature not found' },
        });
      }

      if (result.facets.length === 0 && !hasLLM()) {
        return reply.send({
          data: {
            ...result,
            message: 'Knowledge synthesis requires an LLM provider. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.',
          },
        });
      }

      return reply.send({ data: result });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: { code: 'KNOWLEDGE_FETCH_FAILED', message: err.message },
      });
    }
  });

  // Force full regeneration
  fastify.post('/regenerate', async (request, reply) => {
    const body = request.body as { product?: string; feature?: string };

    if (!body.product) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'product is required in request body' },
      });
    }

    if (!hasLLM()) {
      return reply.status(400).send({
        error: { code: 'LLM_UNAVAILABLE', message: 'Knowledge synthesis requires an LLM provider. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.' },
      });
    }

    try {
      const result = await regenerateKnowledge(request.workspaceId, body.product, body.feature);
      if (!result) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Product or feature not found' },
        });
      }
      return reply.send({ data: result });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: { code: 'KNOWLEDGE_REGENERATE_FAILED', message: err.message },
      });
    }
  });
}
