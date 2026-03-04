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

/** Clear all registered hooks (useful for testing). */
export function clearHooks(): void {
  beforeCommitHooks.length = 0;
  afterCommitHooks.length = 0;
}
