/**
 * Handle [Edit] button press from extraction preview.
 * Opens a modal with pre-filled decision, scope, tags, and ticket fields.
 * On submit, commits the edited decision.
 */
export function registerEditDecision(app: any, callApi: Function) {
  // Open edit modal
  app.action('edit_decision', async ({ action, ack, body, client }: any) => {
    await ack();

    let payload: any;
    try {
      payload = JSON.parse(action.value);
    } catch {
      return;
    }

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'edit_decision_submit',
        private_metadata: JSON.stringify({
          product: payload.product,
          feature: payload.feature,
          author: payload.author,
          source: payload.source,
          response_url: body.response_url,
        }),
        title: { type: 'plain_text', text: 'Edit Decision' },
        submit: { type: 'plain_text', text: 'Commit' },
        blocks: [
          {
            type: 'input',
            block_id: 'decision_block',
            label: { type: 'plain_text', text: 'Decision' },
            element: {
              type: 'plain_text_input',
              action_id: 'decision_input',
              initial_value: payload.decision || '',
              multiline: true,
            },
          },
          {
            type: 'input',
            block_id: 'scope_block',
            label: { type: 'plain_text', text: 'Scope' },
            element: {
              type: 'static_select',
              action_id: 'scope_input',
              initial_option: {
                text: { type: 'plain_text', text: payload.scope || 'minor' },
                value: payload.scope || 'minor',
              },
              options: [
                { text: { type: 'plain_text', text: 'minor' }, value: 'minor' },
                { text: { type: 'plain_text', text: 'major' }, value: 'major' },
                { text: { type: 'plain_text', text: 'architectural' }, value: 'architectural' },
              ],
            },
          },
          {
            type: 'input',
            block_id: 'tags_block',
            label: { type: 'plain_text', text: 'Tags (comma-separated)' },
            optional: true,
            element: {
              type: 'plain_text_input',
              action_id: 'tags_input',
              initial_value: (payload.tags || []).join(', '),
            },
          },
          {
            type: 'input',
            block_id: 'ticket_block',
            label: { type: 'plain_text', text: 'Jira Ticket' },
            optional: true,
            element: {
              type: 'plain_text_input',
              action_id: 'ticket_input',
              placeholder: { type: 'plain_text', text: 'e.g. TRADE-442' },
            },
          },
        ],
      },
    });
  });

  // Handle modal submission
  app.view('edit_decision_submit', async ({ ack, view, client }: any) => {
    await ack();

    const values = view.state.values;
    const metadata = JSON.parse(view.private_metadata);

    const decision = values.decision_block.decision_input.value;
    const scope = values.scope_block.scope_input.selected_option.value;
    const tagsRaw = values.tags_block?.tags_input?.value || '';
    const ticket = values.ticket_block?.ticket_input?.value || '';

    const tags = tagsRaw
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);

    const body: any = {
      message: decision,
      product: metadata.product,
      feature: metadata.feature,
      scope,
      tags,
      author: metadata.author,
      source: metadata.source,
    };

    if (ticket) {
      body.links = [{ type: 'jira', ref: ticket }];
    }

    try {
      const response = await callApi('POST', '/api/v1/locks', body);

      // Use response_url to update the original message
      if (metadata.response_url) {
        const { formatLockCommit, formatError } = await import('../lib/formatters.js');
        const blocks = response.error
          ? formatError(response.error.code || 'LOCK_FAILED', response.error.message)
          : formatLockCommit(response.data || response);

        await fetch(metadata.response_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks, replace_original: true }),
        });
      }
    } catch {
      // Modal already closed — best-effort
    }
  });
}
