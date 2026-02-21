import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { lockRoutes } from './routes/locks.js';
import { productRoutes } from './routes/products.js';
import { featureRoutes } from './routes/features.js';
import { channelConfigRoutes } from './routes/channel-configs.js';
import { knowledgeRoutes } from './routes/knowledge.js';
import { authMiddleware } from './lib/auth.js';
import { uiRoutes } from './routes/ui.js';

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

async function start() {
  // Register CORS
  await fastify.register(cors, { origin: true });

  // Health check + UI — no auth
  await fastify.register(healthRoutes);
  await fastify.register(uiRoutes);

  // API routes — with auth
  await fastify.register(
    async (api) => {
      api.addHook('preHandler', authMiddleware);

      await api.register(lockRoutes, { prefix: '/locks' });
      await api.register(productRoutes, { prefix: '/products' });
      await api.register(featureRoutes, { prefix: '/features' });
      await api.register(channelConfigRoutes, { prefix: '/channel-configs' });
      await api.register(knowledgeRoutes, { prefix: '/knowledge' });
    },
    { prefix: '/api/v1' }
  );

  // Global error handler
  fastify.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    request.log.error(error);
    reply.status(error.statusCode ?? 500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      },
    });
  });

  const port = parseInt(process.env.API_PORT ?? '3000', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Lock Core API running on port ${port}`);
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
