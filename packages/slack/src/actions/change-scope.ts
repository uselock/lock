/**
 * Handle scope dropdown selection from enrichment actions.
 * Calls PATCH /api/v1/locks/:shortId to update scope.
 */
export function registerChangeScope(app: any, callApi: Function) {
  app.action('change_scope', async ({ action, ack, respond, body: actionBody }: any) => {
    await ack();

    const teamId = actionBody.team?.id || '';

    let payload: any;
    try {
      payload = JSON.parse(action.selected_option.value);
    } catch {
      return;
    }

    const { short_id, scope } = payload;

    try {
      const response = await callApi('PATCH', `/api/v1/locks/${short_id}`, { scope }, teamId);

      if (response.error) {
        // Don't replace the whole message — just acknowledge silently
        return;
      }

      const scopeEmoji =
        scope === 'architectural' ? ':rotating_light:' :
        scope === 'major' ? ':large_orange_diamond:' :
        ':small_blue_diamond:';

      await respond({
        blocks: [
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `${scopeEmoji} Scope updated to *${scope}* for \`${short_id}\``,
              },
            ],
          },
        ],
        replace_original: false,
      });
    } catch {
      // Silently fail — scope change is non-critical
    }
  });
}
