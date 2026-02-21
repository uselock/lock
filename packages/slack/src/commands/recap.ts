import type { ParsedCommand } from '../types.js';
import { formatRecapDigest, formatError } from '../lib/formatters.js';

/**
 * Parse a --since value like "7d", "30d", or an ISO date into an ISO date string.
 */
function parseSince(value: string): string {
  const dayMatch = value.match(/^(\d+)d$/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }
  // Try as ISO date
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  // Default: 7 days
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Handle `@lock recap` — show aggregated decision summary.
 *
 * Supports:
 * - --product <slug> (or falls back to channel config)
 * - --since <7d|30d|ISO date>
 * - Org-wide recap if no product specified and no channel config
 */
export async function handleRecap(
  command: ParsedCommand,
  channelId: string,
  callApi: Function,
): Promise<any[]> {
  let product = command.flags.product;

  // If no --product flag, try channel config
  if (!product) {
    try {
      const configResponse = await callApi('GET', `/api/v1/channel-configs/${channelId}`);
      if (configResponse.data?.product?.slug) {
        product = configResponse.data.product.slug;
      } else if (configResponse.data?.product_slug) {
        product = configResponse.data.product_slug;
      }
    } catch {
      // Channel not configured — org-wide recap
    }
  }

  const params = new URLSearchParams();
  if (product) params.set('product', product);
  if (command.flags.since) {
    params.set('since', parseSince(command.flags.since));
  }

  const queryString = params.toString();
  const path = `/api/v1/locks/recap${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await callApi('GET', path);

    if (response.error) {
      return formatError(response.error.code || 'RECAP_FAILED', response.error.message);
    }

    const recap = response.data || response;
    return formatRecapDigest(recap, product);
  } catch (err: any) {
    return formatError('RECAP_FAILED', err.message || 'Failed to fetch recap.');
  }
}
