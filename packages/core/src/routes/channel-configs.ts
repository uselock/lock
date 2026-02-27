import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { channelConfigs, products, features } from '../db/schema.js';
import { DEFAULT_FEATURE } from '../types.js';

export async function channelConfigRoutes(fastify: FastifyInstance) {
  // Create channel → product+feature mapping
  fastify.post('/', async (request, reply) => {
    const { slack_channel_id, product, feature: featureInput } = request.body as {
      slack_channel_id: string;
      product: string;
      feature?: string;
    };

    if (!slack_channel_id || !product) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'slack_channel_id and product are required',
        },
      });
    }

    const feature = featureInput || DEFAULT_FEATURE;

    // Find or create product
    let prod = await db.query.products.findFirst({
      where: and(
        eq(products.workspaceId, request.workspaceId),
        eq(products.slug, product)
      ),
    });
    if (!prod) {
      const name = product
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const [created] = await db
        .insert(products)
        .values({ workspaceId: request.workspaceId, slug: product, name })
        .returning();
      prod = created;
    }

    // Find or create feature
    let feat = await db.query.features.findFirst({
      where: and(eq(features.productId, prod.id), eq(features.slug, feature)),
    });
    if (!feat) {
      const name = feature
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const [created] = await db
        .insert(features)
        .values({
          productId: prod.id,
          slug: feature,
          name,
          slackChannelId: slack_channel_id,
        })
        .returning();
      feat = created;
    }

    // Upsert channel config
    const existing = await db.query.channelConfigs.findFirst({
      where: eq(channelConfigs.slackChannelId, slack_channel_id),
    });

    if (existing) {
      await db
        .update(channelConfigs)
        .set({ productId: prod.id, featureId: feat.id })
        .where(eq(channelConfigs.id, existing.id));
    } else {
      await db.insert(channelConfigs).values({
        workspaceId: request.workspaceId,
        slackChannelId: slack_channel_id,
        productId: prod.id,
        featureId: feat.id,
      });
    }

    return reply.status(201).send({
      data: {
        slack_channel_id,
        product: { slug: prod.slug, name: prod.name },
        feature: { slug: feat.slug, name: feat.name },
      },
    });
  });

  // Get channel config
  fastify.get('/:channelId', async (request, reply) => {
    const { channelId } = request.params as { channelId: string };

    const config = await db.query.channelConfigs.findFirst({
      where: eq(channelConfigs.slackChannelId, channelId),
    });

    if (!config) {
      return reply.status(404).send({
        error: { code: 'CHANNEL_NOT_CONFIGURED', message: 'Channel not configured' },
      });
    }

    const prod = await db.query.products.findFirst({
      where: eq(products.id, config.productId),
    });
    const feat = await db.query.features.findFirst({
      where: eq(features.id, config.featureId),
    });

    return {
      data: {
        slack_channel_id: config.slackChannelId,
        product: prod ? { slug: prod.slug, name: prod.name } : null,
        feature: feat ? { slug: feat.slug, name: feat.name } : null,
      },
    };
  });
}
