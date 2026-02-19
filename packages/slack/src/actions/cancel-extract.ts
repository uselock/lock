/**
 * Handle [Cancel] button press from extraction preview.
 * Replaces the message with a cancellation notice.
 */
export function registerCancelExtract(app: any) {
  app.action('cancel_extract', async ({ ack, respond }: any) => {
    await ack();

    await respond({
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ':no_entry_sign: Decision extraction cancelled.',
          },
        },
      ],
      replace_original: true,
    });
  });
}
