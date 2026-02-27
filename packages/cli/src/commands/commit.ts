import { Command } from 'commander';
import os from 'node:os';
import chalk from 'chalk';
import { getConfig } from '../lib/config.js';
import { apiPost } from '../lib/api-client.js';
import { formatLock, formatConflicts, formatSupersession } from '../lib/formatters.js';

export const commitCommand = new Command('commit')
  .description('Commit a new decision lock')
  .argument('<message>', 'The decision message')
  .option('--scope <scope>', 'Decision scope: minor, major, or architectural', 'minor')
  .option('--type <type>', 'Decision type: product, technical, business, design, process')
  .option('--tag <tag...>', 'Tags for the decision (repeatable)')
  .option('--ticket <ticket>', 'Link a Jira ticket (e.g. TRADE-442)')
  .action(async (message: string, opts) => {
    const config = getConfig();
    if (!config) {
      console.error(chalk.red('Error: No .lock/config.json found.'));
      console.error(chalk.dim('Run `lock init --product <slug>` first to scope this directory.'));
      process.exit(1);
    }

    const username = os.userInfo().username;

    const body: Record<string, unknown> = {
      message,
      product: config.product,
      feature: config.feature || 'main',
      scope: opts.scope,
      tags: opts.tag ?? [],
      author: {
        type: 'human',
        id: username,
        name: username,
        source: 'cli',
      },
      source: {
        type: 'cli',
        ref: `cli:${process.cwd()}`,
      },
    };

    if (opts.type) {
      body.decision_type = opts.type;
    }

    // Add Jira link if --ticket provided
    if (opts.ticket) {
      body.links = [{ type: 'jira', ref: opts.ticket }];
    }

    try {
      const result = await apiPost<any>('/api/v1/locks', body);

      console.log(chalk.green.bold('Lock committed.'));
      console.log('');
      console.log(formatLock(result.lock));

      const conflictOutput = formatConflicts(result.conflicts);
      if (conflictOutput) {
        console.log(conflictOutput);
      }

      const supersessionOutput = formatSupersession(result.supersession);
      if (supersessionOutput) {
        console.log(supersessionOutput);
      }
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
