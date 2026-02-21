import type { ParsedCommand } from '../types.js';
import { getThreadContext } from '../lib/thread-context.js';
import { formatLockCommit, formatExtractionPreview, formatError, formatConflictWarning } from '../lib/formatters.js';

interface LockContext {
  channelId: string;
  userId: string;
  userName: string;
  teamId: string;
  threadTs?: string;
  client: any;
  callApi: Function;
}

/**
 * Handle `@lock <message>` — commit a new decision lock.
 *
 * Supports three modes:
 * - extract: LLM reads thread, extracts decision, shows confirmation
 * - polish: LLM cleans up user's phrasing, auto-commits
 * - explicit: Current behavior, direct commit with message + flags
 */
export async function handleLock(
  command: ParsedCommand,
  context: LockContext,
): Promise<any[]> {
  const { channelId, userId, userName, teamId, threadTs, client, callApi } = context;

  // Get channel config for product/feature
  let channelConfig: any;
  try {
    const configResponse = await callApi('GET', `/api/v1/channel-configs/${channelId}`);
    if (configResponse.error) {
      return formatError(
        'CHANNEL_NOT_CONFIGURED',
        'This channel is not linked to a product and feature.\nRun `@lock init --product <product> --feature <feature>` first.',
      );
    }
    channelConfig = configResponse.data || configResponse;
  } catch {
    return formatError(
      'CHANNEL_NOT_CONFIGURED',
      'This channel is not linked to a product and feature.\nRun `@lock init --product <product> --feature <feature>` first.',
    );
  }

  const product = channelConfig.product?.slug || channelConfig.product;
  const feature = channelConfig.feature?.slug || channelConfig.feature;

  // Get thread context if in a thread
  let threadContext: any = null;
  if (threadTs) {
    try {
      threadContext = await getThreadContext(client, channelId, threadTs);
    } catch {
      // Thread context is optional — proceed without it
    }
  }

  const author = {
    type: 'human' as const,
    id: userId,
    name: userName,
    source: 'slack' as const,
  };

  const source = {
    type: 'slack' as const,
    ref: threadContext?.permalink || undefined,
    context: threadContext?.snippet || undefined,
    participants: threadContext?.participants || [userName],
  };

  switch (command.mode) {
    case 'extract':
      return handleExtractMode(command, { product, feature, author, source, threadTs, callApi });

    case 'polish':
      return handlePolishMode(command, { product, feature, author, source, callApi });

    case 'explicit':
    default:
      return handleExplicitMode(command, { product, feature, author, source, callApi });
  }
}

/**
 * Extract mode: LLM reads thread, extracts decision, shows confirmation buttons.
 */
async function handleExtractMode(
  command: ParsedCommand,
  ctx: { product: string; feature: string; author: any; source: any; threadTs?: string; callApi: Function },
): Promise<any[]> {
  if (!ctx.threadTs) {
    return formatError(
      'NOT_IN_THREAD',
      'Extract mode requires a thread.\nUse `@lock this` inside a thread, or provide a decision: `@lock Use notional value`',
    );
  }

  if (!ctx.source.context) {
    return formatError(
      'NO_THREAD_CONTEXT',
      'Could not read thread context. Try again or provide a decision directly.',
    );
  }

  try {
    const response = await ctx.callApi('POST', '/api/v1/locks/extract', {
      thread_context: ctx.source.context,
      product: ctx.product,
      feature: ctx.feature,
    });

    if (response.error) {
      return formatError(response.error.code || 'EXTRACTION_FAILED', response.error.message);
    }

    const extraction = response.data || response;

    if (!extraction.decision) {
      return formatError(
        'NO_DECISION_FOUND',
        'Could not find a clear decision in this thread.\nTry `@lock <your decision>` to state it directly.',
      );
    }

    return formatExtractionPreview(extraction, {
      product: ctx.product,
      feature: ctx.feature,
      author: ctx.author,
      source: ctx.source,
    });
  } catch (err: any) {
    return formatError('EXTRACTION_FAILED', err.message || 'Failed to extract decision.');
  }
}

/**
 * Polish mode: LLM cleans up user's phrasing, auto-commits.
 */
async function handlePolishMode(
  command: ParsedCommand,
  ctx: { product: string; feature: string; author: any; source: any; callApi: Function },
): Promise<any[]> {
  try {
    // Call extract with user_hint to polish the message
    const extractResponse = await ctx.callApi('POST', '/api/v1/locks/extract', {
      thread_context: ctx.source.context || command.message,
      user_hint: command.message,
      product: ctx.product,
      feature: ctx.feature,
    });

    if (extractResponse.error) {
      return formatError(extractResponse.error.code || 'POLISH_FAILED', extractResponse.error.message);
    }

    const extraction = extractResponse.data || extractResponse;
    const decision = extraction.decision || command.message;

    // Auto-commit with polished decision
    const body: any = {
      message: decision,
      product: ctx.product,
      feature: ctx.feature,
      author: ctx.author,
      source: ctx.source,
      scope: command.flags.scope || extraction.scope,
      tags: command.flags.tags.length > 0 ? command.flags.tags : extraction.tags,
    };

    if (command.flags.type) {
      body.decision_type = command.flags.type;
    } else if (extraction.decision_type) {
      body.decision_type = extraction.decision_type;
    }

    if (command.flags.ticket) {
      body.links = [{ type: 'jira', ref: command.flags.ticket }];
    }

    const commitResponse = await ctx.callApi('POST', '/api/v1/locks', body);

    if (commitResponse.error) {
      return formatError(commitResponse.error.code || 'LOCK_FAILED', commitResponse.error.message);
    }

    return formatLockCommit(commitResponse.data || commitResponse);
  } catch (err: any) {
    return formatError('LOCK_FAILED', err.message || 'Failed to commit lock.');
  }
}

/**
 * Explicit mode: Direct commit with the user's message and flags.
 */
async function handleExplicitMode(
  command: ParsedCommand,
  ctx: { product: string; feature: string; author: any; source: any; callApi: Function },
): Promise<any[]> {
  if (!command.message || command.message.trim().length === 0) {
    return formatError(
      'EMPTY_MESSAGE',
      'Please provide a decision message.\nUsage: `@lock Use notional value instead of margin --scope major`',
    );
  }

  const body: any = {
    message: command.message,
    product: ctx.product,
    feature: ctx.feature,
    author: ctx.author,
    source: ctx.source,
  };

  if (command.flags.scope) {
    body.scope = command.flags.scope;
  }

  if (command.flags.tags.length > 0) {
    body.tags = command.flags.tags;
  }

  if (command.flags.type) {
    body.decision_type = command.flags.type;
  }

  if (command.flags.ticket) {
    body.links = [{ type: 'jira', ref: command.flags.ticket }];
  }

  try {
    // Pre-check for conflicts before committing
    const preCheck = await ctx.callApi('POST', '/api/v1/locks/pre-check', {
      message: command.message,
      product: ctx.product,
      feature: ctx.feature,
      scope: command.flags.scope || 'minor',
    });

    const checkResult = preCheck.data || preCheck;
    const hasConflicts = (checkResult.conflicts?.length > 0) || checkResult.supersession?.detected;

    if (hasConflicts) {
      // Show warning with Commit Anyway / Cancel buttons
      return formatConflictWarning(
        checkResult.conflicts || [],
        checkResult.supersession,
        body,
      );
    }

    // No conflicts — commit directly
    const response = await ctx.callApi('POST', '/api/v1/locks', body);

    if (response.error) {
      return formatError(response.error.code || 'LOCK_FAILED', response.error.message);
    }

    return formatLockCommit(response.data || response);
  } catch (err: any) {
    return formatError('LOCK_FAILED', err.message || 'Failed to commit lock.');
  }
}
