export interface CommitHookContext {
  workspaceId: string;
  lockId: string;
  message: string;
  productSlug: string;
  featureSlug: string;
  scope: string;
  authorType: string;
  authorSource: string;
}

type BeforeCommitHook = (ctx: Omit<CommitHookContext, 'lockId'>) => Promise<void>;
type AfterCommitHook = (ctx: CommitHookContext) => Promise<void>;

const beforeCommitHooks: BeforeCommitHook[] = [];
const afterCommitHooks: AfterCommitHook[] = [];

/** Register a hook that runs before a lock is committed. Can throw to reject (e.g., 402 usage limit). */
export function onBeforeCommit(hook: BeforeCommitHook): void {
  beforeCommitHooks.push(hook);
}

/** Register a hook that runs after a lock is committed. Fire-and-forget (errors are logged, not thrown). */
export function onAfterCommit(hook: AfterCommitHook): void {
  afterCommitHooks.push(hook);
}

/** Run all before:commit hooks. Throws if any hook rejects. */
export async function runBeforeCommitHooks(ctx: Omit<CommitHookContext, 'lockId'>): Promise<void> {
  for (const hook of beforeCommitHooks) {
    await hook(ctx);
  }
}

/** Run all after:commit hooks. Errors are caught and logged. */
export async function runAfterCommitHooks(ctx: CommitHookContext): Promise<void> {
  for (const hook of afterCommitHooks) {
    try {
      await hook(ctx);
    } catch (err) {
      console.error('[hooks] after:commit hook error:', err);
    }
  }
}

// ── Slack token provider (SaaS registers per-workspace token resolution) ──

type SlackTokenProvider = (workspaceId: string) => Promise<string | null>;

let slackTokenProvider: SlackTokenProvider | null = null;

/** Register a provider that resolves per-workspace Slack bot tokens (SaaS multi-tenant). */
export function registerSlackTokenProvider(fn: SlackTokenProvider): void {
  slackTokenProvider = fn;
}

/** Get the registered Slack token provider, or null if none registered. */
export function getSlackTokenProvider(): SlackTokenProvider | null {
  return slackTokenProvider;
}

// ── Feature gate: conflict detection (SaaS billing tier) ──

type ConflictDetectionGate = (ctx: { workspaceId: string }) => Promise<boolean>;

let conflictDetectionGate: ConflictDetectionGate | null = null;

/** Register a gate that controls whether conflict detection runs for a workspace. */
export function registerConflictDetectionGate(fn: ConflictDetectionGate): void {
  conflictDetectionGate = fn;
}

/** Check whether conflict detection should run. Defaults to true (open-source behavior). */
export async function shouldRunConflictDetection(workspaceId: string): Promise<boolean> {
  if (!conflictDetectionGate) return true;
  return conflictDetectionGate({ workspaceId });
}

// ── Feature gate: knowledge synthesis (SaaS billing tier) ──

type KnowledgeSynthesisGate = (ctx: { workspaceId: string }) => Promise<boolean>;

let knowledgeSynthesisGate: KnowledgeSynthesisGate | null = null;

/** Register a gate that controls whether knowledge synthesis runs for a workspace. */
export function registerKnowledgeSynthesisGate(fn: KnowledgeSynthesisGate): void {
  knowledgeSynthesisGate = fn;
}

/** Check whether knowledge synthesis should run. Defaults to true (open-source behavior). */
export async function shouldRunKnowledgeSynthesis(workspaceId: string): Promise<boolean> {
  if (!knowledgeSynthesisGate) return true;
  return knowledgeSynthesisGate({ workspaceId });
}

// ── Feature gate: search (SaaS billing tier) ──

type SearchGate = (ctx: { workspaceId: string }) => Promise<boolean>;

let searchGate: SearchGate | null = null;

/** Register a gate that controls whether full semantic search is available for a workspace. */
export function registerSearchGate(fn: SearchGate): void {
  searchGate = fn;
}

/** Check whether full search should be used. Defaults to true (open-source behavior). */
export async function shouldUseFullSearch(workspaceId: string): Promise<boolean> {
  if (!searchGate) return true;
  return searchGate({ workspaceId });
}

// ── Before:createProduct hooks (SaaS billing tier limits) ──

type BeforeCreateProductHook = (ctx: { workspaceId: string }) => Promise<void>;

const beforeCreateProductHooks: BeforeCreateProductHook[] = [];

/** Register a hook that runs before a product is created. Can throw to reject (e.g., 402 plan limit). */
export function registerBeforeCreateProduct(fn: BeforeCreateProductHook): void {
  beforeCreateProductHooks.push(fn);
}

/** Run all before:createProduct hooks. Throws if any hook rejects. */
export async function runBeforeCreateProductHooks(workspaceId: string): Promise<void> {
  for (const hook of beforeCreateProductHooks) {
    await hook({ workspaceId });
  }
}

/** Clear all registered hooks (useful for testing). */
export function clearHooks(): void {
  beforeCommitHooks.length = 0;
  afterCommitHooks.length = 0;
  slackTokenProvider = null;
  conflictDetectionGate = null;
  knowledgeSynthesisGate = null;
  searchGate = null;
  beforeCreateProductHooks.length = 0;
}
