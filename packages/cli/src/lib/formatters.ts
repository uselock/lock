import chalk, { type ChalkInstance } from 'chalk';

function scopeColor(scope: string): ChalkInstance {
  switch (scope) {
    case 'architectural':
      return chalk.red;
    case 'major':
      return chalk.yellow;
    case 'minor':
    default:
      return chalk.gray;
  }
}

function statusBadge(status: string): string {
  switch (status) {
    case 'active':
      return chalk.green('active');
    case 'superseded':
      return chalk.strikethrough.gray('superseded');
    case 'reverted':
      return chalk.strikethrough.red('reverted');
    case 'proposed':
      return chalk.cyan('proposed');
    case 'auto':
      return chalk.magenta('auto');
    default:
      return status;
  }
}

export function formatLock(lock: any): string {
  const lines: string[] = [];

  const scopeFn = scopeColor(lock.scope);
  const id = chalk.bold.cyan(lock.short_id);
  const scope = scopeFn(`[${lock.scope}]`);
  const status = statusBadge(lock.status);

  lines.push(`${id} ${scope} ${status}`);
  lines.push(`  ${chalk.white(lock.message)}`);
  lines.push('');

  const product = lock.product?.name ?? lock.product?.slug ?? '';
  const feature = lock.feature?.name ?? lock.feature?.slug ?? '';
  lines.push(`  ${chalk.dim('Product:')} ${product}  ${chalk.dim('Feature:')} ${feature}`);

  if (lock.decision_type) {
    lines.push(`  ${chalk.dim('Type:')}    ${lock.decision_type}`);
  }

  const authorName = lock.author?.name ?? lock.author_name ?? 'unknown';
  const authorSource = lock.author?.source ?? lock.author_source ?? '';
  lines.push(`  ${chalk.dim('Author:')}  ${authorName} ${chalk.dim('via')} ${authorSource}`);

  const createdAt = lock.created_at
    ? new Date(lock.created_at).toLocaleString()
    : '';
  lines.push(`  ${chalk.dim('Date:')}    ${createdAt}`);

  // Tags
  const tags: string[] = lock.tags ?? [];
  if (tags.length > 0) {
    lines.push(`  ${chalk.dim('Tags:')}    ${tags.map((t: string) => chalk.blue(`#${t}`)).join(' ')}`);
  }

  // Links
  const links: any[] = lock.links ?? [];
  if (links.length > 0) {
    lines.push(`  ${chalk.dim('Links:')}   ${links.map((l: any) => `${l.link_type ?? l.type}: ${l.link_ref ?? l.ref}`).join(', ')}`);
  }

  // Source context
  if (lock.source_context) {
    lines.push('');
    lines.push(`  ${chalk.dim('Context:')}`);
    const contextLines = lock.source_context.split('\n');
    for (const cl of contextLines) {
      lines.push(`    ${chalk.dim(cl)}`);
    }
  }

  // Source ref
  if (lock.source_ref) {
    lines.push(`  ${chalk.dim('Source:')}  ${lock.source_ref}`);
  }

  // Lineage
  if (lock.supersedes_id || lock.superseded_by_id || lock.reverted_by_id) {
    lines.push('');
    lines.push(`  ${chalk.dim('Lineage:')}`);
    if (lock.supersedes_id) {
      lines.push(`    ${chalk.dim('Supersedes:')} ${lock.supersedes?.short_id ?? lock.supersedes_id}`);
    }
    if (lock.superseded_by_id) {
      lines.push(`    ${chalk.dim('Superseded by:')} ${lock.superseded_by?.short_id ?? lock.superseded_by_id}`);
    }
    if (lock.reverted_by_id) {
      lines.push(`    ${chalk.dim('Reverted by:')} ${lock.reverted_by?.short_id ?? lock.reverted_by_id}`);
    }
  }

  return lines.join('\n');
}

export function formatLockList(locks: any[]): string {
  if (locks.length === 0) {
    return chalk.dim('No locks found.');
  }

  const lines: string[] = [];

  for (const lock of locks) {
    const scopeFn = scopeColor(lock.scope);
    const id = chalk.bold.cyan(lock.short_id);
    const scope = scopeFn(`[${lock.scope}]`);
    const status = statusBadge(lock.status);
    const date = lock.created_at
      ? new Date(lock.created_at).toLocaleDateString()
      : '';
    const author = lock.author?.name ?? lock.author_name ?? '';

    lines.push(`${id}  ${scope}  ${status}  ${chalk.dim(date)}  ${chalk.dim(author)}`);
    lines.push(`  ${lock.message}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatConflicts(conflicts: any[]): string {
  if (!conflicts || conflicts.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.yellow.bold('  Conflicts detected:'));
  lines.push('');

  for (const conflict of conflicts) {
    const rel = conflict.relationship === 'potential_conflict'
      ? chalk.red('CONFLICT')
      : chalk.yellow('RELATED');

    const lockId = chalk.cyan(conflict.lock?.short_id ?? 'unknown');
    lines.push(`  ${rel} with ${lockId}`);
    lines.push(`    ${chalk.dim(conflict.lock?.message ?? '')}`);
    lines.push(`    ${chalk.dim(conflict.explanation)}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatSupersession(supersession: any): string {
  if (!supersession || !supersession.detected) {
    return '';
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.blue.bold('  Supersession detected:'));
  const id = chalk.cyan(supersession.supersedes?.short_id ?? 'unknown');
  lines.push(`    Supersedes ${id}: ${chalk.dim(supersession.supersedes?.message ?? '')}`);
  lines.push(`    ${chalk.dim(supersession.explanation ?? '')}`);
  lines.push('');

  return lines.join('\n');
}
