import type { ParsedCommand } from '../types.js';
import { formatError, formatSuccess } from '../lib/formatters.js';

/**
 * Handle `@lock init`.
 *
 * Two modes:
 * 1. With flags (`--product x` or `--product x --feature y`): direct API call
 * 2. Without flags: return a "Set Up Channel" button that opens a modal
 */
export async function handleInit(
  command: ParsedCommand,
  channelId: string,
  teamId: string,
  callApi: Function,
): Promise<any[]> {
  const { product, feature } = command.flags;

  // If product flag provided, use direct API call
  if (product) {
    try {
      const body: Record<string, string> = {
        slack_channel_id: channelId,
        product,
      };
      if (feature) body.feature = feature;

      const response = await callApi('POST', '/api/v1/channel-configs', body);

      if (response.error) {
        return formatError(response.error.code || 'INIT_FAILED', response.error.message);
      }

      const featureLabel = feature || 'main';
      return formatSuccess(
        `Channel linked to *${product}* / *${featureLabel}*.\nAll locks in this channel will be scoped to this product and feature.`,
      );
    } catch (err: any) {
      return formatError('INIT_FAILED', err.message || 'Failed to initialize channel configuration.');
    }
  }

  // No flags — show the "Set Up Channel" button
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Set up this channel for Lock*\nLink this channel to a product and feature so that all decisions recorded here are automatically scoped.',
      },
      accessory: {
        type: 'button',
        action_id: 'open_init_modal',
        text: { type: 'plain_text', text: 'Set Up Channel' },
        style: 'primary',
        value: JSON.stringify({ channelId, teamId }),
      },
    },
  ];
}
