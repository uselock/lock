/**
 * Handle [Add Jira] and [Add Figma] button presses from enrichment actions.
 * Opens a modal for the user to enter the link reference.
 */
export function registerAddLink(app: any, callApi: Function) {
  // Handle both jira and figma buttons
  app.action('add_link_jira', async ({ action, ack, body, client }: any) => {
    await ack();
    await openLinkModal(client, body.trigger_id, action.value, 'jira', 'Add Jira Ticket', 'e.g. TRADE-442');
  });

  app.action('add_link_figma', async ({ action, ack, body, client }: any) => {
    await ack();
    await openLinkModal(client, body.trigger_id, action.value, 'figma', 'Add Figma Link', 'e.g. https://figma.com/...');
  });

  // Handle modal submission
  app.view('add_link_submit', async ({ ack, view }: any) => {
    await ack();

    const values = view.state.values;
    const metadata = JSON.parse(view.private_metadata);
    const linkRef = values.link_ref_block.link_ref_input.value;

    try {
      await callApi('POST', `/api/v1/locks/${metadata.short_id}/link`, {
        link_type: metadata.link_type,
        link_ref: linkRef,
      });
    } catch {
      // Modal already closed — best-effort
    }
  });
}

async function openLinkModal(
  client: any,
  triggerId: string,
  shortId: string,
  linkType: string,
  title: string,
  placeholder: string,
) {
  await client.views.open({
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: 'add_link_submit',
      private_metadata: JSON.stringify({ short_id: shortId, link_type: linkType }),
      title: { type: 'plain_text', text: title },
      submit: { type: 'plain_text', text: 'Add' },
      blocks: [
        {
          type: 'input',
          block_id: 'link_ref_block',
          label: { type: 'plain_text', text: 'Reference' },
          element: {
            type: 'plain_text_input',
            action_id: 'link_ref_input',
            placeholder: { type: 'plain_text', text: placeholder },
          },
        },
      ],
    },
  });
}
