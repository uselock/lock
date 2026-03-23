import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { features, products } from '../db/schema.js';
import { trackEvent } from '../lib/hooks.js';

export async function featureRoutes(fastify: FastifyInstance) {
  // List features (optionally filtered by product)
  fastify.get('/', async (request, reply) => {
    const { product } = request.query as { product?: string };

    let rows;
    if (product) {
      const prod = await db.query.products.findFirst({
        where: and(
          eq(products.workspaceId, request.workspaceId),
          eq(products.slug, product)
        ),
      });
      if (!prod) {
        return reply.status(404).send({
          error: { code: 'PRODUCT_NOT_FOUND', message: `Product "${product}" not found` },
        });
      }
      rows = await db.query.features.findMany({
        where: eq(features.productId, prod.id),
      });
    } else {
      // All features for all products in workspace
      const prods = await db.query.products.findMany({
        where: eq(products.workspaceId, request.workspaceId),
      });
      const allFeatures = [];
      for (const prod of prods) {
        const feats = await db.query.features.findMany({
          where: eq(features.productId, prod.id),
        });
        allFeatures.push(
          ...feats.map((f) => ({ ...f, productSlug: prod.slug, productName: prod.name }))
        );
      }
      return {
        data: {
          features: allFeatures.map((f) => ({
            slug: f.slug,
            name: f.name,
            description: f.description,
            product: { slug: f.productSlug, name: f.productName },
            product_slug: f.productSlug,
            product_name: f.productName,
            created_at: f.createdAt,
          })),
        },
      };
    }

    const prod = await db.query.products.findFirst({
      where: and(
        eq(products.workspaceId, request.workspaceId),
        eq(products.slug, product!)
      ),
    });

    return {
      data: {
        features: rows.map((f) => ({
          slug: f.slug,
          name: f.name,
          description: f.description,
          product: prod ? { slug: prod.slug, name: prod.name } : null,
          product_slug: prod?.slug ?? null,
          product_name: prod?.name ?? null,
          created_at: f.createdAt,
        })),
      },
    };
  });

  // Create feature
  fastify.post('/', async (request, reply) => {
    const { slug, name, description, product } = request.body as {
      slug: string;
      name: string;
      description?: string;
      product: string;
    };

    if (!slug || !name || !product) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'slug, name, and product are required' },
      });
    }

    const prod = await db.query.products.findFirst({
      where: and(
        eq(products.workspaceId, request.workspaceId),
        eq(products.slug, product)
      ),
    });
    if (!prod) {
      return reply.status(404).send({
        error: { code: 'PRODUCT_NOT_FOUND', message: `Product "${product}" not found` },
      });
    }

    const existing = await db.query.features.findFirst({
      where: and(eq(features.productId, prod.id), eq(features.slug, slug)),
    });
    if (existing) {
      return reply.status(409).send({
        error: { code: 'FEATURE_EXISTS', message: `Feature "${slug}" already exists` },
      });
    }

    const [feature] = await db
      .insert(features)
      .values({ productId: prod.id, slug, name, description })
      .returning();

    trackEvent(request.workspaceId, 'feature_created', { slug: feature.slug, name: feature.name, product: prod.slug });
    return reply.status(201).send({
      data: {
        slug: feature.slug,
        name: feature.name,
        description: feature.description,
        product: { slug: prod.slug, name: prod.name },
        created_at: feature.createdAt,
      },
    });
  });

  // Update feature
  fastify.patch('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { description, name, product } = request.body as {
      description?: string;
      name?: string;
      product?: string;
    };

    // Find feature across products in workspace
    const prods = await db.query.products.findMany({
      where: eq(products.workspaceId, request.workspaceId),
    });

    let feature = null;
    let ownerProd = null;
    for (const prod of prods) {
      if (product && prod.slug !== product) continue;
      const f = await db.query.features.findFirst({
        where: and(eq(features.productId, prod.id), eq(features.slug, slug)),
      });
      if (f) {
        feature = f;
        ownerProd = prod;
        break;
      }
    }

    if (!feature) {
      return reply.status(404).send({
        error: { code: 'FEATURE_NOT_FOUND', message: `Feature "${slug}" not found` },
      });
    }

    const updates: any = {};
    if (description !== undefined) updates.description = description;
    if (name !== undefined) updates.name = name;

    const [updated] = await db
      .update(features)
      .set(updates)
      .where(eq(features.id, feature.id))
      .returning();

    return {
      data: {
        slug: updated.slug,
        name: updated.name,
        description: updated.description,
        product: ownerProd ? { slug: ownerProd.slug, name: ownerProd.name } : null,
        created_at: updated.createdAt,
      },
    };
  });
}
