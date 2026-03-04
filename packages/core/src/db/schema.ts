import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
  unique,
  customType,
} from 'drizzle-orm/pg-core';

// Custom pgvector type
const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown): number[] {
    const str = value as string;
    return str
      .slice(1, -1)
      .split(',')
      .map(Number);
  },
});

// Workspaces (tenants)
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  slackTeamId: text('slack_team_id').unique(),
  slug: text('slug').unique(),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('free'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Products
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('products_workspace_slug').on(table.workspaceId, table.slug),
  ]
);

// Features
export const features = pgTable(
  'features',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    slackChannelId: text('slack_channel_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('features_product_slug').on(table.productId, table.slug),
  ]
);

// Locks (decisions)
export const locks = pgTable(
  'locks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shortId: text('short_id').notNull().unique(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    featureId: uuid('feature_id')
      .notNull()
      .references(() => features.id),
    message: text('message').notNull(),

    // Author
    authorType: text('author_type').notNull(), // 'human' | 'agent'
    authorId: text('author_id').notNull(),
    authorName: text('author_name').notNull(),
    authorSource: text('author_source').notNull(), // 'slack' | 'cli' | 'mcp' | 'api'
    authorUserId: uuid('author_user_id'), // nullable — populated by SaaS

    // Classification
    scope: text('scope').notNull().default('minor'), // 'minor' | 'major' | 'architectural'
    status: text('status').notNull().default('active'), // 'active' | 'superseded' | 'reverted' | 'proposed' | 'auto'
    tags: text('tags').array().default([]),
    decisionType: text('decision_type'),

    // Source context
    sourceType: text('source_type').notNull(), // 'slack' | 'cli' | 'agent_session' | 'api'
    sourceRef: text('source_ref'),
    sourceContext: text('source_context'),
    participants: text('participants').array().default([]),

    // Lineage
    supersedesId: uuid('supersedes_id').references((): any => locks.id),
    supersededById: uuid('superseded_by_id').references((): any => locks.id),
    revertedById: uuid('reverted_by_id').references((): any => locks.id),

    // Embedding
    embedding: vector('embedding'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_locks_workspace').on(table.workspaceId),
    index('idx_locks_product').on(table.productId),
    index('idx_locks_feature').on(table.featureId),
    index('idx_locks_status').on(table.status),
    index('idx_locks_short_id').on(table.shortId),
    index('idx_locks_decision_type').on(table.decisionType),
  ]
);

// External links
export const lockLinks = pgTable('lock_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  lockId: uuid('lock_id')
    .notNull()
    .references(() => locks.id),
  linkType: text('link_type').notNull(), // 'jira' | 'figma' | 'github' | 'linear' | 'notion' | 'other'
  linkRef: text('link_ref').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Channel configurations
export const channelConfigs = pgTable('channel_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  slackChannelId: text('slack_channel_id').notNull().unique(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  featureId: uuid('feature_id')
    .notNull()
    .references(() => features.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// API keys
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(),
  name: text('name').notNull(),
  scopes: text('scopes').array().default(['read', 'write']),
  createdBy: uuid('created_by'), // nullable — populated by SaaS
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
});

// Knowledge (synthesized product/feature understanding)
export const knowledge = pgTable(
  'knowledge',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    featureId: uuid('feature_id').references(() => features.id), // null = product-level
    facet: text('facet').notNull(), // 'summary' | 'principles' | 'tensions' | 'trajectory'
    content: text('content').notNull(),
    version: integer('version').notNull().default(1),
    lockCountAtGeneration: integer('lock_count_at_generation').notNull().default(0),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_knowledge_product').on(table.productId),
    index('idx_knowledge_feature').on(table.featureId),
    unique('knowledge_product_feature_facet').on(table.productId, table.featureId, table.facet),
  ]
);
