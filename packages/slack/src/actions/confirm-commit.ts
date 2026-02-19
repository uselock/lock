import { formatLockCommit, formatError } from '../lib/formatters.js';

/**
 * Handle [Commit] button press from extraction preview.
 * Parses commit metadata from button value, calls POST /api/v1/locks,
 * and replaces the preview message with the commit result.
 */
export function registerConfirmCommit(app: any, callApi: Function) {
  app.action('confirm_commit', async ({ action, ack, respond }: any) => {
    await ack();

    let payload: any;
    try {
      payload = JSON.parse(action.value);
    } catch {
      await respond({ blocks: formatError('PARSE_ERROR', 'Failed to parse commit data.'), replace_original: true });
      return;
    }

    const body = {
      message: payload.decision,
      product: payload.product,
      feature: payload.feature,
      scope: payload.scope,
      tags: payload.tags,
      author: payload.author,
      source: payload.source,
    };

    if (payload.ticket) {
      (body as any).links = [{ type: 'jira', ref: payload.ticket }];
    }

    try {
      const response = await callApi('POST', '/api/v1/locks', body);

      if (response.error) {
        await respond({ blocks: formatError(response.error.code || 'LOCK_FAILED', response.error.message), replace_original: true });
        return;
      }

      const blocks = formatLockCommit(response.data || response);
      await respond({ blocks, replace_original: true });
    } catch (err: any) {
      await respond({ blocks: formatError('LOCK_FAILED', err.message || 'Failed to commit lock.'), replace_original: true });
    }
  });
}
