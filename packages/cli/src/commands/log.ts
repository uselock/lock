import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from '../lib/config.js';
import { apiGet } from '../lib/api-client.js';
import { formatLockList } from '../lib/formatters.js';

export const logCommand = new Command('log')
  .description('List recent decision locks')
  .option('--product <slug>', 'Filter by product')
  .option('--feature <slug>', 'Filter by feature')
  .option('--scope <scope>', 'Filter by scope: minor, major, architectural')
  .option('--type <type>', 'Filter by decision type: product, technical, business, design, process')
  .option('--status <status>', 'Filter by status: active, superseded, reverted, proposed')
  .option('--limit <n>', 'Max number of results', '20')
  .action(async (opts) => {
    const config = getConfig();

    const params = new URLSearchParams();

    // Use config defaults if not overridden by flags
    const product = opts.product ?? config?.product;
    const feature = opts.feature ?? config?.feature;

    if (product) params.set('product', product);
    if (feature) params.set('feature', feature);
    if (opts.scope) params.set('scope', opts.scope);
    if (opts.type) params.set('decision_type', opts.type);
    if (opts.status) params.set('status', opts.status);
    if (opts.limit) params.set('limit', opts.limit);

    const query = params.toString();
    const path = `/api/v1/locks${query ? `?${query}` : ''}`;

    try {
      const result = await apiGet<any>(path);
      const locks = result.locks ?? result ?? [];

      console.log(formatLockList(Array.isArray(locks) ? locks : []));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
