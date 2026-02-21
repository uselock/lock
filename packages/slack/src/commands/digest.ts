import type { ParsedCommand } from '../types.js';
import { formatSuccess, formatError } from '../lib/formatters.js';
import { addDigestConfig, removeDigestConfig } from '../services/digest-scheduler.js';

/**
 * Handle `@lock digest` — configure scheduled digest posts.
 *
 * Usage:
 *   @lock digest --schedule weekly --hour 9 [--product <slug>]
 *   @lock digest --schedule daily --hour 9
 *   @lock digest off — remove digest for this channel
 */
export async function handleDigest(
  command: ParsedCommand,
  channelId: string,
  callApi: Function,
): Promise<any[]> {
  // Handle "off" to remove
  if (command.message?.trim().toLowerCase() === 'off') {
    const removed = removeDigestConfig(channelId);
    if (removed) {
      return formatSuccess('Digest removed for this channel.');
    }
    return formatError('NO_DIGEST', 'No digest configured for this channel.');
  }

  const schedule = command.flags.schedule as 'daily' | 'weekly';
  if (!schedule || (schedule !== 'daily' && schedule !== 'weekly')) {
    return formatError(
      'INVALID_SCHEDULE',
      'Please specify `--schedule daily` or `--schedule weekly`.\nUsage: `@lock digest --schedule weekly --hour 9 [--product <slug>]`',
    );
  }

  const hour = command.flags.hour ? parseInt(command.flags.hour, 10) : undefined;
  if (hour === undefined || isNaN(hour) || hour < 0 || hour > 23) {
    return formatError(
      'INVALID_HOUR',
      'Please specify `--hour <0-23>`.\nUsage: `@lock digest --schedule weekly --hour 9`',
    );
  }

  let product = command.flags.product;

  // If no product, try channel config
  if (!product) {
    try {
      const configResponse = await callApi('GET', `/api/v1/channel-configs/${channelId}`);
      if (configResponse.data?.product?.slug) {
        product = configResponse.data.product.slug;
      }
    } catch {
      // No channel config
    }
  }

  addDigestConfig({
    channelId,
    product,
    schedule,
    hour,
    dayOfWeek: schedule === 'weekly' ? 1 : undefined, // Default: Monday
  });

  const timeStr = `${hour}:00`;
  const scheduleStr = schedule === 'weekly' ? 'every Monday' : 'daily';
  const productStr = product ? ` for *${product}*` : '';

  return formatSuccess(`Digest configured: ${scheduleStr} at ${timeStr}${productStr}.`);
}
