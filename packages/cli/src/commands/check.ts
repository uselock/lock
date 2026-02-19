import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from '../lib/config.js';
import { apiPost } from '../lib/api-client.js';

export const checkCommand = new Command('check')
  .description('Check for existing decisions relevant to what you are about to build')
  .argument('<intent>', 'What you are about to build or change')
  .option('--product <slug>', 'Filter by product')
  .option('--feature <slug>', 'Filter by feature')
  .action(async (intent: string, opts) => {
    const config = getConfig();

    const body: Record<string, unknown> = { query: intent };

    const product = opts.product ?? config?.product;
    const feature = opts.feature;

    if (product) body.product = product;
    if (feature) body.feature = feature;

    try {
      const result = await apiPost<any>('/api/v1/locks/search', body);
      const locks = result.locks ?? result ?? [];

      if (!Array.isArray(locks) || locks.length === 0) {
        console.log(chalk.green('No relevant decisions found. Proceed as planned.'));
        return;
      }

      console.log(chalk.bold('Relevant decisions:'));
      console.log('');

      locks.forEach((lock: any, i: number) => {
        const scopeFn =
          lock.scope === 'architectural' ? chalk.red :
          lock.scope === 'major' ? chalk.yellow :
          chalk.dim;

        const authorName = lock.author?.name ?? lock.author_name ?? 'unknown';
        const featureSlug = lock.feature?.slug ?? lock.feature ?? '';
        const date = lock.created_at
          ? new Date(lock.created_at).toLocaleDateString()
          : '';

        console.log(`${i + 1}. ${scopeFn(`[${lock.scope}]`)} ${chalk.cyan(lock.short_id)}: ${lock.message}`);
        console.log(`   ${chalk.dim(`Feature: ${featureSlug} | Author: ${authorName} | ${date}`)}`);
        console.log('');
      });

      console.log(chalk.dim('If your work contradicts a decision, use `lock commit` to record a superseding decision.'));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
