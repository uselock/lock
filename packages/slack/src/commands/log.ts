import type { ParsedCommand } from '../types.js';
import { formatLockList, formatError } from '../lib/formatters.js';

/**
 * Handle `@lock log` — list recent locks with optional filters.
 *
 * Supports filters via flags:
 * - --product <slug>
 * - --feature <slug>
 * - --scope <minor|major|architectural>
 */
export async function handleLog(
  command: ParsedCommand,
  callApi: Function,
): Promise<any[]> {
  const params = new URLSearchParams();

  if (command.flags.product) {
    params.set('product', command.flags.product);
  }
  if (command.flags.feature) {
    params.set('feature', command.flags.feature);
  }
  if (command.flags.scope) {
    params.set('scope', command.flags.scope);
  }
  if (command.flags.type) {
    params.set('decision_type', command.flags.type);
  }

  // Default limit
  params.set('limit', '10');

  const queryString = params.toString();
  const path = `/api/v1/locks${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await callApi('GET', path);

    if (response.error) {
      return formatError(response.error.code || 'LOG_FAILED', response.error.message);
    }

    const locks = response.data?.locks || response.locks || response.data || [];
    return formatLockList(Array.isArray(locks) ? locks : []);
  } catch (err: any) {
    return formatError('LOG_FAILED', err.message || 'Failed to fetch locks.');
  }
}
