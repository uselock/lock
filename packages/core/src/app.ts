import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { healthRoutes } from './routes/health.js';
import { lockRoutes } from './routes/locks.js';
import { productRoutes } from './routes/products.js';
import { featureRoutes } from './routes/features.js';
import { channelConfigRoutes } from './routes/channel-configs.js';
import { knowledgeRoutes } from './routes/knowledge.js';
import { authMiddleware } from './lib/auth.js';

export interface BuildAppOptions {
  logger?: boolean | object;
  /** Fastify plugins to register before routes (e.g., @fastify/cookie) */
  plugins?: Array<{ plugin: any; options?: any }>;
  /** Additional route registrations inside the /api/v1 auth-protected scope */
  protectedRoutes?: Array<{ routes: any; prefix: string }>;
  /** Route registrations outside auth (e.g., webhook endpoints) */
  unprotectedRoutes?: Array<{ routes: any }>;
  /** CORS origins (comma-separated string or array). false = disabled. */
  corsOrigins?: string[] | false;
}

const WEAK_SECRETS = ['change-me', 'change-me-to-a-random-string', 'lock-internal-secret', 'secret', 'test'];

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: options.logger ?? {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

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

  // Register any additional plugins (e.g., @fastify/cookie for SaaS)
  if (options.plugins) {
    for (const { plugin, options: pluginOpts } of options.plugins) {
      await fastify.register(plugin, pluginOpts);
    }
  }

  // Register CORS
  const corsOrigins = options.corsOrigins ??
    (process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || false);
  await fastify.register(cors, {
    origin: Array.isArray(corsOrigins) && corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

  // Global rate limit: 100 requests/minute per IP
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Health check — no auth
  await fastify.register(healthRoutes);

  // Unprotected routes (e.g., auth routes, webhooks)
  if (options.unprotectedRoutes) {
    for (const { routes } of options.unprotectedRoutes) {
      await fastify.register(routes);
    }
  }

  // API routes — with auth
  await fastify.register(
    async (api) => {
      api.addHook('preHandler', authMiddleware);

      await api.register(lockRoutes, { prefix: '/locks' });
      await api.register(productRoutes, { prefix: '/products' });
      await api.register(featureRoutes, { prefix: '/features' });
      await api.register(channelConfigRoutes, { prefix: '/channel-configs' });
      await api.register(knowledgeRoutes, { prefix: '/knowledge' });

      // Additional protected routes (e.g., SaaS billing, workspaces)
      if (options.protectedRoutes) {
        for (const { routes, prefix } of options.protectedRoutes) {
          await api.register(routes, { prefix });
        }
      }
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

  return fastify;
}
