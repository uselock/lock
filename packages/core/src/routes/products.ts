import type { FastifyInstance } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { products, locks } from '../db/schema.js';
import { getPostHog } from '../lib/posthog.js';

export async function productRoutes(fastify: FastifyInstance) {
  // List products with lock counts
  fastify.get('/', async (request) => {
    if (!request.workspaceId) {
      return { data: { products: [] } };
    }
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        description: products.description,
        createdAt: products.createdAt,
        lockCount: sql<number>`(SELECT COUNT(*) FROM locks WHERE locks.product_id = ${products.id})`.as('lock_count'),
      })
      .from(products)
      .where(eq(products.workspaceId, request.workspaceId));

    return {
      data: {
        products: rows.map((r) => ({
          slug: r.slug,
          name: r.name,
          description: r.description,
          lock_count: Number(r.lockCount),
          created_at: r.createdAt,
        })),
      },
    };
  });

  // Create product
  fastify.post('/', async (request, reply) => {
    if (!request.workspaceId) {
      return reply.status(401).send({
        error: { code: 'NO_WORKSPACE', message: 'No workspace selected' },
      });
    }
    const { slug, name, description } = request.body as {
      slug: string;
      name: string;
      description?: string;
    };

    if (!slug || !name) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'slug and name are required' },
      });
    }

    const existing = await db.query.products.findFirst({
      where: and(eq(products.workspaceId, request.workspaceId), eq(products.slug, slug)),
    });
    if (existing) {
      return reply.status(409).send({
        error: { code: 'PRODUCT_EXISTS', message: `Product "${slug}" already exists` },
      });
    }

    const [product] = await db
      .insert(products)
      .values({ workspaceId: request.workspaceId, slug, name, description })
      .returning();

    getPostHog()?.capture({
      distinctId: request.workspaceId,
      event: 'product_created',
      properties: { slug: product.slug, name: product.name },
    });
    return reply.status(201).send({
      data: {
        slug: product.slug,
        name: product.name,
        description: product.description,
        created_at: product.createdAt,
      },
    });
  });

  // Update product
  fastify.patch('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { description, name } = request.body as { description?: string; name?: string };

    const product = await db.query.products.findFirst({
      where: and(eq(products.workspaceId, request.workspaceId), eq(products.slug, slug)),
    });
    if (!product) {
      return reply.status(404).send({
        error: { code: 'PRODUCT_NOT_FOUND', message: `Product "${slug}" not found` },
      });
    }

    const updates: any = {};
    if (description !== undefined) updates.description = description;
    if (name !== undefined) updates.name = name;

    const [updated] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, product.id))
      .returning();

    return {
      data: {
        slug: updated.slug,
        name: updated.name,
        description: updated.description,
        created_at: updated.createdAt,
      },
    };
  });
}
