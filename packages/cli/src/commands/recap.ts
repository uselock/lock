import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from '../lib/config.js';
import { apiGet } from '../lib/api-client.js';

export const recapCommand = new Command('recap')
  .description('Show a summary of recent decisions')
  .option('--product <slug>', 'Filter by product')
  .option('--since <date>', 'Since date (e.g. "7d", "30d", or ISO date)')
  .action(async (opts) => {
    const config = getConfig();

    const params = new URLSearchParams();

    const product = opts.product ?? config?.product;
    if (product) params.set('product', product);

    if (opts.since) {
      const dayMatch = opts.since.match(/^(\d+)d$/);
      if (dayMatch) {
        const days = parseInt(dayMatch[1], 10);
        params.set('since', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
      } else {
        params.set('since', opts.since);
      }
    }

    const query = params.toString();
    const path = `/api/v1/locks/recap${query ? `?${query}` : ''}`;

    try {
      const recap = await apiGet<any>(path);

      const { period, summary, decisions, top_contributors } = recap;
      const fromDate = new Date(period.from).toLocaleDateString();
      const toDate = new Date(period.to).toLocaleDateString();

      console.log('');
      console.log(chalk.bold(`Recap: ${fromDate} – ${toDate}`));
      console.log(chalk.dim(`${summary.total_decisions} decision(s)`));
      console.log('');

      // Scope breakdown
      if (Object.keys(summary.by_scope).length > 0) {
        const scopeStr = Object.entries(summary.by_scope as Record<string, number>)
          .map(([k, v]) => `${k}: ${v}`)
          .join('  ');
        console.log(`  ${chalk.dim('Scopes:')}  ${scopeStr}`);
      }

      // Type breakdown
      if (Object.keys(summary.by_type).length > 0) {
        const typeStr = Object.entries(summary.by_type as Record<string, number>)
          .map(([k, v]) => `${k}: ${v}`)
          .join('  ');
        console.log(`  ${chalk.dim('Types:')}   ${typeStr}`);
      }

      if (summary.reverts > 0 || summary.supersessions > 0) {
        console.log(`  ${chalk.dim('Reverts:')} ${summary.reverts}  ${chalk.dim('Supersessions:')} ${summary.supersessions}`);
      }

      // Top contributors
      if (top_contributors && top_contributors.length > 0) {
        console.log('');
        console.log(chalk.dim('Top contributors:'));
        for (const c of top_contributors) {
          console.log(`  ${c.name} (${c.count})`);
        }
      }

      // Key decisions
      const keyDecisions = (decisions || [])
        .filter((d: any) => d.scope === 'architectural' || d.scope === 'major')
        .slice(0, 5);

      if (keyDecisions.length > 0) {
        console.log('');
        console.log(chalk.bold('Key decisions:'));
        console.log('');
        for (const lock of keyDecisions) {
          const scopeFn =
            lock.scope === 'architectural' ? chalk.red :
            lock.scope === 'major' ? chalk.yellow :
            chalk.dim;
          const typeBadge = lock.decision_type ? ` [${lock.decision_type}]` : '';
          console.log(`  ${scopeFn(`[${lock.scope}]`)}${typeBadge} ${chalk.cyan(lock.short_id)}: ${lock.message}`);
          console.log(`    ${chalk.dim(`${lock.author?.name || 'unknown'} | ${lock.feature?.name || 'unknown'}`)}`);
        }
      }

      console.log('');
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
