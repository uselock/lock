/**
 * Handle [Add tags] button press from enrichment actions.
 * Opens a modal for comma-separated tag input, then calls PATCH to update.
 */
export function registerAddTags(app: any, callApi: Function) {
  app.action('add_tags', async ({ action, ack, body, client }: any) => {
    await ack();

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'add_tags_submit',
        private_metadata: JSON.stringify({ short_id: action.value, teamId: body.team?.id || '' }),
        title: { type: 'plain_text', text: 'Add Tags' },
        submit: { type: 'plain_text', text: 'Save' },
        blocks: [
          {
            type: 'input',
            block_id: 'tags_block',
            label: { type: 'plain_text', text: 'Tags (comma-separated)' },
            element: {
              type: 'plain_text_input',
              action_id: 'tags_input',
              placeholder: { type: 'plain_text', text: 'e.g. margin, display, risk' },
            },
          },
        ],
      },
    });
  });

  app.view('add_tags_submit', async ({ ack, view }: any) => {
    await ack();

    const values = view.state.values;
    const metadata = JSON.parse(view.private_metadata);
    const tagsRaw = values.tags_block.tags_input.value || '';

    const tags = tagsRaw
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);

    if (tags.length === 0) return;

    try {
      await callApi('PATCH', `/api/v1/locks/${metadata.short_id}`, { tags }, metadata.teamId || view.team_id || '');
    } catch {
      // Modal already closed — best-effort
    }
  });
}
