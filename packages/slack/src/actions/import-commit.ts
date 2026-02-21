import type { App } from '@slack/bolt';

export function registerImportCommit(app: App, callApi: Function): void {
  // Commit an imported decision
  app.action('import_commit', async ({ action, ack, respond, body }) => {
    await ack();

    if (action.type !== 'button' || !action.value) return;

    try {
      const payload = JSON.parse(action.value);
      const teamId = body.team?.id || '';
      const userId = body.user?.id || 'unknown';

      // Resolve user name
      let userName = userId;
      try {
        const userInfo = await (app.client as any).users.info({ user: userId });
        userName =
          userInfo.user?.profile?.display_name ||
          userInfo.user?.real_name ||
          userInfo.user?.name ||
          userId;
      } catch {
        // Fall back to user ID
      }

      const lockBody = {
        message: payload.decision,
        product: payload.product,
        feature: payload.feature,
        scope: payload.scope || 'minor',
        tags: [...(payload.tags || []), 'imported'],
        decision_type: payload.decision_type,
        author: {
          type: 'human',
          id: userId,
          name: userName,
          source: 'slack',
        },
        source: {
          type: 'slack',
          ref: 'imported-from-history',
        },
      };

      const teamCallApi = (method: string, path: string, body?: any) => {
        const headers: Record<string, string> = {};
        if (teamId) headers['X-Workspace-Team-Id'] = teamId;
        return callApi(method, path, body, teamId);
      };

      const result = await teamCallApi('POST', '/api/v1/locks', lockBody);

      if (result.error) {
        await respond({
          text: `:x: Failed to commit: ${result.error.message}`,
          replace_original: false,
        });
        return;
      }

      const lock = result.data?.lock || result.lock;
      await respond({
        text: `:lock: Imported and committed as \`${lock?.short_id || 'unknown'}\``,
        replace_original: false,
      });
    } catch (err: any) {
      await respond({
        text: `:x: Error: ${err.message}`,
        replace_original: false,
      });
    }
  });

  // Skip an imported decision
  app.action('import_skip', async ({ ack, respond }) => {
    await ack();
    await respond({
      text: '_Skipped._',
      replace_original: false,
    });
  });
}
