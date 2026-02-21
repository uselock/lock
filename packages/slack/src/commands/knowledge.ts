import type { ParsedCommand } from '../types.js';
import { formatKnowledge, formatError } from '../lib/formatters.js';

export async function handleKnowledge(
  command: ParsedCommand,
  channelId: string,
  callApi: Function,
): Promise<any[]> {
  let product = command.flags.product;
  let feature = command.flags.feature;

  // If no --product flag, try channel config
  if (!product) {
    try {
      const configResponse = await callApi('GET', `/api/v1/channel-configs/${channelId}`);
      if (configResponse.data?.product?.slug) {
        product = configResponse.data.product.slug;
      } else if (configResponse.data?.product_slug) {
        product = configResponse.data.product_slug;
      }
      if (!feature) {
        if (configResponse.data?.feature?.slug) {
          feature = configResponse.data.feature.slug;
        } else if (configResponse.data?.feature_slug) {
          feature = configResponse.data.feature_slug;
        }
      }
    } catch {
      // Channel not configured
    }
  }

  if (!product) {
    return formatError(
      'MISSING_PRODUCT',
      'Please specify a product: `@lock knowledge --product <slug>`\nOr initialize this channel with `@lock init --product <slug> --feature <slug>`',
    );
  }

  const params = new URLSearchParams();
  params.set('product', product);
  if (feature) params.set('feature', feature);

  const path = `/api/v1/knowledge?${params.toString()}`;

  try {
    const response = await callApi('GET', path);

    if (response.error) {
      return formatError(response.error.code || 'KNOWLEDGE_FAILED', response.error.message);
    }

    const knowledge = response.data || response;
    return formatKnowledge(knowledge);
  } catch (err: any) {
    return formatError('KNOWLEDGE_FAILED', err.message || 'Failed to fetch knowledge.');
  }
}
