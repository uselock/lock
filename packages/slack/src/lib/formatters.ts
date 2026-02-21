/**
 * Block Kit formatters for Slack responses.
 *
 * Each function returns an array of Slack Block Kit blocks
 * suitable for use with `blocks` in Slack API responses.
 */

/**
 * Build the enrichment actions block appended to committed locks.
 * Includes scope dropdown, add-jira, add-figma, and add-tags buttons.
 */
function buildEnrichmentActions(shortId: string, currentScope: string): any {
  return {
    type: 'actions',
    block_id: `enrichment_${shortId}`,
    elements: [
      {
        type: 'static_select',
        action_id: 'change_scope',
        placeholder: { type: 'plain_text', text: 'Change scope' },
        initial_option: {
          text: { type: 'plain_text', text: currentScope },
          value: JSON.stringify({ short_id: shortId, scope: currentScope }),
        },
        options: [
          { text: { type: 'plain_text', text: 'minor' }, value: JSON.stringify({ short_id: shortId, scope: 'minor' }) },
          { text: { type: 'plain_text', text: 'major' }, value: JSON.stringify({ short_id: shortId, scope: 'major' }) },
          { text: { type: 'plain_text', text: 'architectural' }, value: JSON.stringify({ short_id: shortId, scope: 'architectural' }) },
        ],
      },
      {
        type: 'button',
        action_id: 'add_link_jira',
        text: { type: 'plain_text', text: 'Add Jira' },
        value: shortId,
      },
      {
        type: 'button',
        action_id: 'add_link_figma',
        text: { type: 'plain_text', text: 'Add Figma' },
        value: shortId,
      },
      {
        type: 'button',
        action_id: 'add_tags',
        text: { type: 'plain_text', text: 'Add tags' },
        value: shortId,
      },
    ],
  };
}

/**
 * Format the extraction preview with [Commit] [Edit] [Cancel] buttons.
 */
export function formatExtractionPreview(extraction: any, metadata: any): any[] {
  const blocks: any[] = [];

  const scopeEmoji =
    extraction.scope === 'architectural' ? ':rotating_light:' :
    extraction.scope === 'major' ? ':large_orange_diamond:' :
    ':small_blue_diamond:';

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:mag: *Decision extracted* — please confirm`,
    },
  });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `> ${extraction.decision}`,
    },
  });

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `${scopeEmoji} *${extraction.scope}* | Confidence: ${Math.round(extraction.confidence * 100)}%${extraction.tags?.length ? ` | Tags: ${extraction.tags.map((t: string) => `\`${t}\``).join(' ')}` : ''}`,
      },
    ],
  });

  if (extraction.reasoning) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_${extraction.reasoning}_`,
        },
      ],
    });
  }

  // Pack metadata into button values (truncate context to stay under 2000 chars)
  const commitPayload = {
    decision: extraction.decision,
    scope: extraction.scope,
    tags: extraction.tags,
    product: metadata.product,
    feature: metadata.feature,
    author: metadata.author,
    source: metadata.source,
  };
  let commitValue = JSON.stringify(commitPayload);
  // Truncate source context if payload too long
  if (commitValue.length > 1900 && commitPayload.source?.context) {
    commitPayload.source.context = commitPayload.source.context.slice(0, 200) + '...';
    commitValue = JSON.stringify(commitPayload);
  }

  blocks.push({
    type: 'actions',
    block_id: 'extraction_actions',
    elements: [
      {
        type: 'button',
        action_id: 'confirm_commit',
        text: { type: 'plain_text', text: 'Commit' },
        style: 'primary',
        value: commitValue,
      },
      {
        type: 'button',
        action_id: 'edit_decision',
        text: { type: 'plain_text', text: 'Edit' },
        value: commitValue,
      },
      {
        type: 'button',
        action_id: 'cancel_extract',
        text: { type: 'plain_text', text: 'Cancel' },
        style: 'danger',
        value: 'cancel',
      },
    ],
  });

  return blocks;
}

/**
 * Format a committed lock with conflicts and supersession info.
 * Includes enrichment action buttons for scope/link/tag changes.
 */
export function formatLockCommit(data: any): any[] {
  const { lock, conflicts, supersession } = data;
  const blocks: any[] = [];

  // Main lock block
  const scopeEmoji =
    lock.scope === 'architectural' ? ':rotating_light:' :
    lock.scope === 'major' ? ':large_orange_diamond:' :
    ':small_blue_diamond:';

  const typeBadge = lock.decision_type ? ` | :label: ${lock.decision_type}` : '';

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:lock: *Lock committed* \`${lock.short_id}\`\n${scopeEmoji} *${lock.scope}*${typeBadge} | ${lock.product?.name || lock.product?.slug || 'unknown'} / ${lock.feature?.name || lock.feature?.slug || 'unknown'}`,
    },
  });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `> ${lock.message}`,
    },
  });

  // Author and timestamp
  const authorSource = lock.author?.source || lock.author_source || 'unknown';
  const authorName = lock.author?.name || lock.author_name || 'unknown';
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `By *${authorName}* via ${authorSource} | ${new Date(lock.created_at).toLocaleString()}`,
      },
    ],
  });

  // Tags
  if (lock.tags && lock.tags.length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Tags: ${lock.tags.map((t: string) => `\`${t}\``).join(' ')}`,
        },
      ],
    });
  }

  // Supersession info
  if (supersession?.detected) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:arrows_counterclockwise: *Supersedes* \`${supersession.supersedes.short_id}\`\n> ${supersession.supersedes.message}\n_${supersession.explanation}_`,
      },
    });
  }

  // Conflicts
  if (conflicts && conflicts.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:warning: *Potential conflicts detected* (${conflicts.length})`,
      },
    });

    for (const conflict of conflicts) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`${conflict.lock.short_id}\` — ${conflict.lock.message}\n_${conflict.explanation}_`,
        },
      });
    }
  }

  // Enrichment actions
  blocks.push(buildEnrichmentActions(lock.short_id, lock.scope));

  return blocks;
}

/**
 * Format a list of locks for display.
 */
export function formatLockList(locks: any[]): any[] {
  const blocks: any[] = [];

  if (locks.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':mag: No locks found matching your filters.',
      },
    });
    return blocks;
  }

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:lock: *${locks.length} lock${locks.length === 1 ? '' : 's'} found*`,
    },
  });

  blocks.push({ type: 'divider' });

  for (const lock of locks) {
    const scopeEmoji =
      lock.scope === 'architectural' ? ':rotating_light:' :
      lock.scope === 'major' ? ':large_orange_diamond:' :
      ':small_blue_diamond:';

    const statusBadge =
      lock.status === 'active' ? '' :
      lock.status === 'superseded' ? ' ~superseded~' :
      lock.status === 'reverted' ? ' ~reverted~' :
      ` _(${lock.status})_`;

    const productSlug = lock.product?.slug || lock.product || '';
    const featureSlug = lock.feature?.slug || lock.feature || '';
    const scope = `${productSlug}/${featureSlug}`;
    const typeBadge = lock.decision_type ? ` | ${lock.decision_type}` : '';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${scopeEmoji} \`${lock.short_id}\` ${lock.message}${statusBadge}\n_${scope}${typeBadge} | ${lock.author?.name || lock.author_name || 'unknown'} | ${new Date(lock.created_at).toLocaleDateString()}_`,
      },
    });
  }

  return blocks;
}

/**
 * Format a list of products with lock counts.
 */
export function formatProductList(products: any[]): any[] {
  const blocks: any[] = [];

  if (products.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':package: No products found. Create one with `@lock init --product <name> --feature <name>`.',
      },
    });
    return blocks;
  }

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:package: *${products.length} product${products.length === 1 ? '' : 's'}*`,
    },
  });

  blocks.push({ type: 'divider' });

  for (const product of products) {
    const lockCount = product.lock_count ?? product.lockCount ?? 0;
    const description = product.description ? `\n_${product.description}_` : '';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${product.name}* (\`${product.slug}\`) — ${lockCount} lock${lockCount === 1 ? '' : 's'}${description}`,
      },
    });
  }

  return blocks;
}

/**
 * Format a list of features.
 */
export function formatFeatureList(features: any[]): any[] {
  const blocks: any[] = [];

  if (features.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':clipboard: No features found. Create one with `@lock init --product <name> --feature <name>`.',
      },
    });
    return blocks;
  }

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:clipboard: *${features.length} feature${features.length === 1 ? '' : 's'}*`,
    },
  });

  blocks.push({ type: 'divider' });

  for (const feature of features) {
    const productSlug = feature.product?.slug || feature.product_slug || '';
    const lockCount = feature.lock_count ?? feature.lockCount ?? 0;
    const description = feature.description ? `\n_${feature.description}_` : '';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${feature.name}* (\`${productSlug}/${feature.slug}\`) — ${lockCount} lock${lockCount === 1 ? '' : 's'}${description}`,
      },
    });
  }

  return blocks;
}

/**
 * Format a recap of active decisions grouped by feature.
 */
export function formatRecap(locks: any[], productSlug: string): any[] {
  const blocks: any[] = [];

  if (locks.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':mag: No active decisions found.',
      },
    });
    return blocks;
  }

  // Group locks by feature slug
  const byFeature = new Map<string, { name: string; slug: string; locks: any[] }>();
  for (const lock of locks) {
    const slug = lock.feature?.slug || lock.feature || 'unknown';
    const name = lock.feature?.name || slug;
    if (!byFeature.has(slug)) {
      byFeature.set(slug, { name, slug, locks: [] });
    }
    byFeature.get(slug)!.locks.push(lock);
  }

  // Sort locks within each feature by scope weight: architectural first
  const scopeWeight: Record<string, number> = { architectural: 0, major: 1, minor: 2 };
  for (const group of byFeature.values()) {
    group.locks.sort((a: any, b: any) =>
      (scopeWeight[a.scope] ?? 2) - (scopeWeight[b.scope] ?? 2),
    );
  }

  // Derive product display name from first lock
  const productName = locks[0]?.product?.name || productSlug;

  // Header
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:clipboard: *Active Decisions — ${productName}*\n${locks.length} decision${locks.length === 1 ? '' : 's'} across ${byFeature.size} feature${byFeature.size === 1 ? '' : 's'}`,
    },
  });

  // Per-feature sections
  for (const group of byFeature.values()) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${group.name}* (\`${group.slug}\`)`,
      },
    });

    for (const lock of group.locks) {
      const scopeEmoji =
        lock.scope === 'architectural' ? ':rotating_light:' :
        lock.scope === 'major' ? ':large_orange_diamond:' :
        ':small_blue_diamond:';

      const authorName = lock.author?.name || lock.author_name || 'unknown';
      const date = lock.created_at
        ? new Date(lock.created_at).toLocaleDateString()
        : '';

      const typeBadge = lock.decision_type ? ` [${lock.decision_type}]` : '';

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${scopeEmoji} \`${lock.short_id}\`${typeBadge} ${lock.message}\n_${authorName} | ${date}_`,
        },
      });
    }
  }

  return blocks;
}

/**
 * Format a recap digest with stats breakdowns.
 */
export function formatRecapDigest(recap: any, product?: string): any[] {
  const blocks: any[] = [];
  const { period, summary, decisions, top_contributors } = recap;

  if (summary.total_decisions === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':mag: No decisions found for this period.',
      },
    });
    return blocks;
  }

  // Header
  const fromDate = new Date(period.from).toLocaleDateString();
  const toDate = new Date(period.to).toLocaleDateString();
  const title = product ? `Recap — ${product}` : 'Recap — All Products';

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:clipboard: *${title}*\n${fromDate} – ${toDate} | ${summary.total_decisions} decision${summary.total_decisions === 1 ? '' : 's'}`,
    },
  });

  // Stats
  const scopeStr = Object.entries(summary.by_scope as Record<string, number>)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  const typeStr = Object.entries(summary.by_type as Record<string, number>)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  let statsText = `*Scopes:* ${scopeStr || 'none'}`;
  if (typeStr) statsText += `\n*Types:* ${typeStr}`;
  if (summary.reverts > 0) statsText += ` | Reverts: ${summary.reverts}`;
  if (summary.supersessions > 0) statsText += ` | Supersessions: ${summary.supersessions}`;

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: statsText }],
  });

  // Top contributors
  if (top_contributors && top_contributors.length > 0) {
    const contribStr = top_contributors
      .map((c: any) => `${c.name} (${c.count})`)
      .join(', ');
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `*Top contributors:* ${contribStr}` }],
    });
  }

  // By product (for org-wide)
  if (!product && summary.by_product && summary.by_product.length > 0) {
    blocks.push({ type: 'divider' });
    for (const p of summary.by_product) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${p.name}* (\`${p.slug}\`) — ${p.count} decision${p.count === 1 ? '' : 's'}`,
        },
      });
    }
  }

  // Key decisions (architectural + major, max 5)
  const keyDecisions = (decisions || [])
    .filter((d: any) => d.scope === 'architectural' || d.scope === 'major')
    .slice(0, 5);

  if (keyDecisions.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*Key Decisions*' },
    });
    for (const lock of keyDecisions) {
      const scopeEmoji =
        lock.scope === 'architectural' ? ':rotating_light:' :
        ':large_orange_diamond:';
      const typeBadge = lock.decision_type ? ` [${lock.decision_type}]` : '';
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${scopeEmoji} \`${lock.short_id}\`${typeBadge} ${lock.message}\n_${lock.author?.name || 'unknown'} | ${lock.feature?.name || 'unknown'}_`,
        },
      });
    }
  }

  return blocks;
}

/**
 * Format import candidate decisions for confirmation.
 */
export function formatImportCandidates(candidates: any[], metadata: any): any[] {
  const blocks: any[] = [];

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:mag: *Found ${candidates.length} potential decision${candidates.length === 1 ? '' : 's'}* in channel history`,
    },
  });

  const maxDisplay = Math.min(candidates.length, 10);
  for (let i = 0; i < maxDisplay; i++) {
    const candidate = candidates[i];
    const scopeEmoji =
      candidate.scope === 'architectural' ? ':rotating_light:' :
      candidate.scope === 'major' ? ':large_orange_diamond:' :
      ':small_blue_diamond:';

    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${scopeEmoji} *${i + 1}.* ${candidate.decision}\n_Confidence: ${Math.round(candidate.confidence * 100)}% | ${candidate.reasoning}_`,
      },
    });

    const payload = {
      decision: candidate.decision,
      scope: candidate.scope,
      decision_type: candidate.decision_type,
      tags: candidate.tags,
      product: metadata.product,
      feature: metadata.feature,
    };
    let payloadStr = JSON.stringify(payload);
    if (payloadStr.length > 1900) {
      payload.decision = payload.decision.slice(0, 200) + '...';
      payloadStr = JSON.stringify(payload);
    }

    blocks.push({
      type: 'actions',
      block_id: `import_candidate_${i}`,
      elements: [
        {
          type: 'button',
          action_id: 'import_commit',
          text: { type: 'plain_text', text: 'Commit' },
          style: 'primary',
          value: payloadStr,
        },
        {
          type: 'button',
          action_id: 'import_skip',
          text: { type: 'plain_text', text: 'Skip' },
          value: String(i),
        },
      ],
    });
  }

  if (candidates.length > 10) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_Showing first 10 of ${candidates.length} candidates._` }],
    });
  }

  return blocks;
}

/**
 * Format synthesized knowledge for display.
 */
export function formatKnowledge(knowledge: any): any[] {
  const blocks: any[] = [];

  if (knowledge.message) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `:bulb: ${knowledge.message}` },
    });
    return blocks;
  }

  if (!knowledge.facets || knowledge.facets.length === 0) {
    const scope = knowledge.feature
      ? `${knowledge.product?.name || 'unknown'} / ${knowledge.feature?.name || 'unknown'}`
      : knowledge.product?.name || 'unknown';
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `:bulb: No knowledge synthesized yet for *${scope}*. Commit some decisions first.` },
    });
    return blocks;
  }

  const scope = knowledge.feature
    ? `${knowledge.product.name} / ${knowledge.feature.name}`
    : knowledge.product.name;

  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: `:brain: *Knowledge — ${scope}*` },
  });

  const facetEmojis: Record<string, string> = {
    summary: ':memo:',
    principles: ':dart:',
    tensions: ':warning:',
    trajectory: ':chart_with_upwards_trend:',
  };

  const facetTitles: Record<string, string> = {
    summary: 'Summary',
    principles: 'Principles',
    tensions: 'Tensions & Open Questions',
    trajectory: 'Trajectory',
  };

  for (const entry of knowledge.facets) {
    const emoji = facetEmojis[entry.facet] || ':bulb:';
    const title = facetTitles[entry.facet] || entry.facet;

    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `${emoji} *${title}*` },
    });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: entry.content },
    });
  }

  // Metadata
  const first = knowledge.facets[0];
  if (first) {
    const date = first.updated_at ? new Date(first.updated_at).toLocaleDateString() : 'unknown';
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `v${first.version} | ${first.lock_count_at_generation} decisions | Updated ${date}`,
      }],
    });
  }

  return blocks;
}

/**
 * Format an error response.
 */
export function formatError(code: string, message: string): any[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:x: *Error* — \`${code}\`\n${message}`,
      },
    },
  ];
}

/**
 * Format a success message.
 */
export function formatSuccess(message: string): any[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:white_check_mark: ${message}`,
      },
    },
  ];
}

/**
 * Format a conflict warning with Commit Anyway / Cancel buttons.
 */
export function formatConflictWarning(
  conflicts: any[],
  supersession: any,
  commitPayload: any,
): any[] {
  const blocks: any[] = [];

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:warning: *Conflict detected* — this decision overlaps with existing locks:`,
    },
  });

  if (supersession?.detected && supersession.supersedes) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:lock: \`${supersession.supersedes.short_id}\` — ${supersession.supersedes.message}\n_${supersession.explanation || ''}_`,
      },
    });
  }

  for (const conflict of conflicts) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:lock: \`${conflict.lock.short_id}\` — ${conflict.lock.message}\n_${conflict.explanation || ''}_`,
      },
    });
  }

  blocks.push({ type: 'divider' });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Your decision:*\n> ${commitPayload.message}`,
    },
  });

  blocks.push({
    type: 'actions',
    block_id: 'conflict_actions',
    elements: [
      {
        type: 'button',
        action_id: 'force_commit',
        text: { type: 'plain_text', text: 'Commit anyway' },
        style: 'primary',
        value: JSON.stringify(commitPayload),
      },
      {
        type: 'button',
        action_id: 'cancel_commit',
        text: { type: 'plain_text', text: 'Cancel' },
        style: 'danger',
        value: 'cancel',
      },
    ],
  });

  return blocks;
}
