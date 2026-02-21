import { formatLockCommit, formatError } from '../lib/formatters.js';

/**
 * Handle [Commit anyway] button from conflict warning.
 * Commits the decision despite detected conflicts.
 */
export function registerForceCommit(app: any, callApi: Function) {
  app.action('force_commit', async ({ action, ack, respond, body: actionBody }: any) => {
    await ack();

    const teamId = actionBody.team?.id || '';

    let payload: any;
    try {
      payload = JSON.parse(action.value);
    } catch {
      await respond({ blocks: formatError('PARSE_ERROR', 'Failed to parse commit data.'), replace_original: true });
      return;
    }

    try {
      const response = await callApi('POST', '/api/v1/locks', payload, teamId);

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

  app.action('cancel_commit', async ({ ack, respond }: any) => {
    await ack();
    await respond({
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '_Commit cancelled._' } }],
      replace_original: true,
    });
  });
}
