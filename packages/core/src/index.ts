import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { healthRoutes } from './routes/health.js';
import { lockRoutes } from './routes/locks.js';
import { productRoutes } from './routes/products.js';
import { featureRoutes } from './routes/features.js';
import { channelConfigRoutes } from './routes/channel-configs.js';
import { knowledgeRoutes } from './routes/knowledge.js';
import { authMiddleware } from './lib/auth.js';
import { startTelemetry } from './services/telemetry-service.js';


const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

const WEAK_SECRETS = ['change-me', 'change-me-to-a-random-string', 'lock-internal-secret', 'secret', 'test'];

async function start() {
  // Validate INTERNAL_SECRET
  const internalSecret = process.env.INTERNAL_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  if (!internalSecret || WEAK_SECRETS.includes(internalSecret)) {
    if (isProduction) {
      fastify.log.error('INTERNAL_SECRET is missing or set to a known weak value. Refusing to start in production.');
      process.exit(1);
    } else {
      fastify.log.warn('WARNING: INTERNAL_SECRET is missing or set to a known weak value. Do not use this in production.');
    }
  }

  // Register CORS — no browser clients need CORS for this API-only service
  await fastify.register(cors, { origin: false });

  // Global rate limit: 100 requests/minute per IP
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Health check — no auth
  await fastify.register(healthRoutes);

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
  startTelemetry(fastify.log);
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
