import type { ParsedCommand } from '../types.js';
import { formatRecap, formatError } from '../lib/formatters.js';

/**
 * Handle `@lock recap` — show all active decisions grouped by feature.
 *
 * Resolves the product from --product flag or channel config.
 * Optionally filters by --feature.
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
      // Channel not configured — product stays undefined
    }
  }

  if (!product) {
    return formatError(
      'NO_PRODUCT',
      'Specify `--product <slug>` or run `@lock init` in this channel first.',
    );
  }

  const params = new URLSearchParams();
  params.set('status', 'active');
  params.set('product', product);
  params.set('limit', '100');

  if (command.flags.feature) {
    params.set('feature', command.flags.feature);
  }

  const path = `/api/v1/locks?${params.toString()}`;

  try {
    const response = await callApi('GET', path);

    if (response.error) {
      return formatError(response.error.code || 'RECAP_FAILED', response.error.message);
    }

    const locks = response.data?.locks || response.locks || response.data || [];
    return formatRecap(Array.isArray(locks) ? locks : [], product);
  } catch (err: any) {
    return formatError('RECAP_FAILED', err.message || 'Failed to fetch locks.');
  }
}
