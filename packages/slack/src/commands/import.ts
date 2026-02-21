import type { ParsedCommand } from '../types.js';
import { formatImportCandidates, formatError } from '../lib/formatters.js';

interface ImportContext {
  channelId: string;
  userId: string;
  userName: string;
  teamId: string;
  client: any;
  callApi: Function;
}

/**
 * Handle `@lock import` — scan channel history for decisions.
 *
 * Usage:
 *   @lock import [--days <n>]
 *
 * Requires the channel to be configured with @lock init first.
 */
export async function handleImport(
  command: ParsedCommand,
  context: ImportContext,
): Promise<any[]> {
  const { channelId, client, callApi } = context;

  // Get channel config
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

  // Parse --days flag
  const days = command.flags.days ? parseInt(command.flags.days, 10) : 7;
  const oldest = String(Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000));

  // Fetch channel history
  const allMessages: any[] = [];
  let cursor: string | undefined;

  try {
    do {
      const result: any = await client.conversations.history({
        channel: channelId,
        oldest,
        limit: 200,
        cursor,
      });

      if (result.messages) {
        allMessages.push(...result.messages);
      }
      cursor = result.response_metadata?.next_cursor;
    } while (cursor);
  } catch (err: any) {
    return formatError('HISTORY_FAILED', `Could not read channel history: ${err.message}`);
  }

  if (allMessages.length === 0) {
    return formatError('NO_MESSAGES', `No messages found in the last ${days} day(s).`);
  }

  // Resolve user names
  const userCache = new Map<string, string>();
  async function resolveUser(userId: string): Promise<string> {
    if (userCache.has(userId)) return userCache.get(userId)!;
    try {
      const info = await client.users.info({ user: userId });
      const name =
        info.user?.profile?.display_name ||
        info.user?.real_name ||
        info.user?.name ||
        userId;
      userCache.set(userId, name);
      return name;
    } catch {
      userCache.set(userId, userId);
      return userId;
    }
  }

  // Format messages for batch extraction
  const formatted = await Promise.all(
    allMessages
      .filter((m: any) => m.text && !m.bot_id) // Skip bot messages
      .reverse() // Chronological order
      .map(async (m: any) => ({
        text: m.text,
        author: await resolveUser(m.user || 'unknown'),
        timestamp: new Date(parseFloat(m.ts) * 1000).toISOString(),
      }))
  );

  if (formatted.length === 0) {
    return formatError('NO_MESSAGES', 'No human messages found to analyze.');
  }

  // Call batch extraction
  try {
    const response = await callApi('POST', '/api/v1/locks/extract-batch', {
      messages: formatted,
      product,
      feature,
    });

    if (response.error) {
      return formatError(response.error.code || 'EXTRACTION_FAILED', response.error.message);
    }

    const data = response.data || response;
    const candidates = data.candidates || [];

    if (candidates.length === 0) {
      return [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:mag: Analyzed ${formatted.length} messages from the last ${days} day(s). No decisions found.`,
        },
      }];
    }

    return formatImportCandidates(candidates, { product, feature });
  } catch (err: any) {
    return formatError('IMPORT_FAILED', err.message || 'Failed to extract decisions.');
  }
}
