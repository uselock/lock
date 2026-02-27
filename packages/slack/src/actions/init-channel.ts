/**
 * Handle the modal-based channel init flow.
 *
 * 1. open_init_modal     — Opens modal with product + feature fields
 * 2. init_product_mode   — Toggles between "Create new" / "Use existing" product
 * 3. init_channel_submit — Processes submission: creates product, feature, channel config
 */
export function registerInitChannel(app: any, callApi: Function) {
  // 1. Button click → open modal
  app.action('open_init_modal', async ({ action, ack, body, client }: any) => {
    await ack();

    let payload: any;
    try {
      payload = JSON.parse(action.value);
    } catch {
      return;
    }

    const teamId = payload.teamId || body.team?.id || '';

    // Fetch existing products to decide whether to show the mode toggle
    let products: any[] = [];
    try {
      const res = await callApi('GET', '/api/v1/products', undefined, teamId);
      products = res.data?.products || [];
    } catch {
      // Continue without products — user can still create new
    }

    // Check if channel is already configured
    let existingConfig: any = null;
    try {
      const res = await callApi('GET', `/api/v1/channel-configs/${payload.channelId}`, undefined, teamId);
      if (res.data) existingConfig = res.data;
    } catch {
      // No existing config — that's fine
    }

    const hasProducts = products.length > 0;

    const metadata = JSON.stringify({
      channelId: payload.channelId,
      teamId,
      mode: 'new',
    });

    const blocks: any[] = [];

    // Show current config warning if channel is already set up
    if (existingConfig?.product && existingConfig?.feature) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `This channel is currently linked to *${existingConfig.product.name}* / *${existingConfig.feature.name}*. Submitting will update it.`,
          },
        ],
      });
    }

    // Mode toggle (only if products exist)
    if (hasProducts) {
      blocks.push(buildModeToggle('new'));
    }

    // New product fields (default)
    blocks.push(...buildNewProductBlocks());

    // Feature fields (always shown)
    blocks.push(...buildFeatureBlocks());

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'init_channel_submit',
        private_metadata: metadata,
        title: { type: 'plain_text', text: 'Set Up Channel' },
        submit: { type: 'plain_text', text: 'Set Up' },
        blocks,
      },
    });
  });

  // 2. Radio toggle → swap product fields
  app.action('init_product_mode', async ({ ack, body, client }: any) => {
    await ack();

    const view = body.view;
    const metadata = JSON.parse(view.private_metadata);
    const selectedMode = body.actions[0].selected_option.value;

    metadata.mode = selectedMode;

    const blocks: any[] = [];

    // Keep the mode toggle
    blocks.push(buildModeToggle(selectedMode));

    // Product fields based on mode
    if (selectedMode === 'existing') {
      // Re-fetch products from API (not stored in metadata)
      let products: any[] = [];
      try {
        const res = await callApi('GET', '/api/v1/products', undefined, metadata.teamId);
        products = res.data?.products || [];
      } catch {
        // Fall through with empty list
      }

      const displayProducts = products.slice(0, 100);
      const productOptions = displayProducts.map((p: any) => ({
        text: { type: 'plain_text', text: p.name || p.slug },
        value: p.slug,
      }));

      const productBlocks: any[] = [];
      if (products.length > 100) {
        productBlocks.push({
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `Showing first 100 of ${products.length} products.` },
          ],
        });
      }
      productBlocks.push({
        type: 'input',
        block_id: 'existing_product_block',
        label: { type: 'plain_text', text: 'Product' },
        element: {
          type: 'static_select',
          action_id: 'existing_product_input',
          placeholder: { type: 'plain_text', text: 'Select a product' },
          options: productOptions,
        },
      });
      blocks.push(...productBlocks);
    } else {
      blocks.push(...buildNewProductBlocks());
    }

    // Feature fields (always shown)
    blocks.push(...buildFeatureBlocks());

    await client.views.update({
      view_id: view.id,
      hash: view.hash,
      view: {
        type: 'modal',
        callback_id: 'init_channel_submit',
        private_metadata: JSON.stringify(metadata),
        title: { type: 'plain_text', text: 'Set Up Channel' },
        submit: { type: 'plain_text', text: 'Set Up' },
        blocks,
      },
    });
  });

  // 3. Modal submission
  app.view('init_channel_submit', async ({ ack, view, client }: any) => {
    const values = view.state.values;
    const metadata = JSON.parse(view.private_metadata);

    let productSlug: string;
    let productName: string;

    if (metadata.mode === 'existing') {
      // Read from dropdown
      productSlug = values.existing_product_block?.existing_product_input?.selected_option?.value;
      if (!productSlug) {
        await ack({ response_action: 'errors', errors: { existing_product_block: 'Please select a product.' } });
        return;
      }
      productName = values.existing_product_block.existing_product_input.selected_option.text.text;
    } else {
      // Read from text inputs
      productName = values.product_name_block?.product_name_input?.value?.trim();
      productSlug = values.product_slug_block?.product_slug_input?.value?.trim();
      const productDesc = values.product_desc_block?.product_desc_input?.value?.trim();

      if (!productName || !productSlug || !productDesc) {
        const errors: Record<string, string> = {};
        if (!productName) errors.product_name_block = 'Product name is required.';
        if (!productSlug) errors.product_slug_block = 'Product slug is required.';
        if (!productDesc) errors.product_desc_block = 'Product description is required.';
        await ack({ response_action: 'errors', errors });
        return;
      }

      if (!/^[a-z0-9-]+$/.test(productSlug)) {
        await ack({ response_action: 'errors', errors: { product_slug_block: 'Slug must be lowercase letters, numbers, and hyphens only.' } });
        return;
      }

      // Create product
      try {
        const res = await callApi('POST', '/api/v1/products', {
          slug: productSlug,
          name: productName,
          description: productDesc,
        }, metadata.teamId || view.team_id || '');

        if (res.error && res.error.code !== 'PRODUCT_EXISTS') {
          await ack({ response_action: 'errors', errors: { product_slug_block: res.error.message || 'Failed to create product.' } });
          return;
        }
      } catch (err: any) {
        await ack({ response_action: 'errors', errors: { product_slug_block: err.message || 'Failed to create product.' } });
        return;
      }
    }

    // Read feature fields
    const featureName = values.feature_name_block?.feature_name_input?.value?.trim();
    const featureSlug = values.feature_slug_block?.feature_slug_input?.value?.trim();
    const featureDesc = values.feature_desc_block?.feature_desc_input?.value?.trim() || undefined;

    if (!featureName || !featureSlug) {
      const errors: Record<string, string> = {};
      if (!featureName) errors.feature_name_block = 'Feature name is required.';
      if (!featureSlug) errors.feature_slug_block = 'Feature slug is required.';
      await ack({ response_action: 'errors', errors });
      return;
    }

    if (!/^[a-z0-9-]+$/.test(featureSlug)) {
      await ack({ response_action: 'errors', errors: { feature_slug_block: 'Slug must be lowercase letters, numbers, and hyphens only.' } });
      return;
    }

    const teamId = metadata.teamId || view.team_id || '';

    // Create feature
    try {
      const body: any = {
        slug: featureSlug,
        name: featureName,
        product: productSlug,
      };
      if (featureDesc) body.description = featureDesc;

      const res = await callApi('POST', '/api/v1/features', body, teamId);
      if (res.error && res.error.code !== 'FEATURE_EXISTS') {
        await ack({ response_action: 'errors', errors: { feature_slug_block: res.error.message || 'Failed to create feature.' } });
        return;
      }
    } catch (err: any) {
      await ack({ response_action: 'errors', errors: { feature_slug_block: err.message || 'Failed to create feature.' } });
      return;
    }

    // Create channel config
    try {
      const res = await callApi('POST', '/api/v1/channel-configs', {
        slack_channel_id: metadata.channelId,
        product: productSlug,
        feature: featureSlug,
      }, teamId);

      if (res.error) {
        await ack({ response_action: 'errors', errors: { feature_slug_block: res.error.message || 'Failed to link channel.' } });
        return;
      }
    } catch (err: any) {
      await ack({ response_action: 'errors', errors: { feature_slug_block: err.message || 'Failed to link channel.' } });
      return;
    }

    // All good — close modal
    await ack();

    // Post success message to channel
    try {
      await client.chat.postMessage({
        channel: metadata.channelId,
        text: `Channel linked to *${productName}* / *${featureName}*`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:white_check_mark: *Channel set up!*\nThis channel is now linked to *${productName}* (\`${productSlug}\`) / *${featureName}* (\`${featureSlug}\`).\n\nAll \`@lock\` commands here will automatically use this scope.`,
            },
          },
        ],
      });
    } catch {
      // Best-effort notification
    }
  });
}

/** Build the mode toggle radio buttons. */
function buildModeToggle(selectedMode: string): any {
  return {
    type: 'actions',
    block_id: 'mode_block',
    elements: [
      {
        type: 'radio_buttons',
        action_id: 'init_product_mode',
        initial_option: {
          text: { type: 'plain_text', text: selectedMode === 'new' ? 'Create new product' : 'Use existing product' },
          value: selectedMode,
        },
        options: [
          {
            text: { type: 'plain_text', text: 'Create new product' },
            value: 'new',
          },
          {
            text: { type: 'plain_text', text: 'Use existing product' },
            value: 'existing',
          },
        ],
      },
    ],
  };
}

/** Build the input blocks for creating a new product. */
function buildNewProductBlocks(): any[] {
  return [
    {
      type: 'input',
      block_id: 'product_name_block',
      label: { type: 'plain_text', text: 'Product Name' },
      element: {
        type: 'plain_text_input',
        action_id: 'product_name_input',
        max_length: 100,
        placeholder: { type: 'plain_text', text: 'e.g. Trading Platform' },
      },
    },
    {
      type: 'input',
      block_id: 'product_slug_block',
      label: { type: 'plain_text', text: 'Product Slug' },
      element: {
        type: 'plain_text_input',
        action_id: 'product_slug_input',
        max_length: 50,
        placeholder: { type: 'plain_text', text: 'e.g. trading' },
      },
    },
    {
      type: 'input',
      block_id: 'product_desc_block',
      label: { type: 'plain_text', text: 'Product Description' },
      element: {
        type: 'plain_text_input',
        action_id: 'product_desc_input',
        multiline: true,
        max_length: 500,
        placeholder: { type: 'plain_text', text: 'What does this product do? This helps the LLM understand context.' },
      },
    },
  ];
}

/** Build the input blocks for feature (always shown). */
function buildFeatureBlocks(): any[] {
  return [
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Feature*',
      },
    },
    {
      type: 'input',
      block_id: 'feature_name_block',
      label: { type: 'plain_text', text: 'Feature Name' },
      element: {
        type: 'plain_text_input',
        action_id: 'feature_name_input',
        max_length: 100,
        placeholder: { type: 'plain_text', text: 'e.g. Margin Engine' },
      },
    },
    {
      type: 'input',
      block_id: 'feature_slug_block',
      label: { type: 'plain_text', text: 'Feature Slug' },
      element: {
        type: 'plain_text_input',
        action_id: 'feature_slug_input',
        max_length: 50,
        placeholder: { type: 'plain_text', text: 'e.g. margin-engine' },
      },
    },
    {
      type: 'input',
      block_id: 'feature_desc_block',
      label: { type: 'plain_text', text: 'Feature Description' },
      optional: true,
      element: {
        type: 'plain_text_input',
        action_id: 'feature_desc_input',
        multiline: true,
        max_length: 500,
        placeholder: { type: 'plain_text', text: 'Optional — what does this feature area cover?' },
      },
    },
  ];
}
