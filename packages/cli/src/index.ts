#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { commitCommand } from './commands/commit.js';
import { logCommand } from './commands/log.js';
import { productsCommand } from './commands/products.js';
import { featuresCommand } from './commands/features.js';
import { showCommand } from './commands/show.js';
import { revertCommand } from './commands/revert.js';
import { linkCommand } from './commands/link.js';
import { searchCommand } from './commands/search.js';
import { checkCommand } from './commands/check.js';
import { exportCommand } from './commands/export.js';
import { recapCommand } from './commands/recap.js';
import { knowledgeCommand } from './commands/knowledge.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { whoamiCommand } from './commands/whoami.js';

const program = new Command();

program
  .name('lock')
  .description('Lock — The decision protocol for product teams')
  .version('0.1.0');

// Register subcommands
program.addCommand(initCommand);
program.addCommand(commitCommand);
program.addCommand(logCommand);
program.addCommand(productsCommand);
program.addCommand(featuresCommand);
program.addCommand(showCommand);
program.addCommand(revertCommand);
program.addCommand(linkCommand);
program.addCommand(searchCommand);
program.addCommand(checkCommand);
program.addCommand(exportCommand);
program.addCommand(recapCommand);
program.addCommand(knowledgeCommand);
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);

// Default action: if the first argument doesn't match a known subcommand,
// treat it as a shorthand for `lock commit "message"`.
// We detect this by checking if argv[2] exists and is not a registered command or flag.
const knownCommands = new Set(
  program.commands.map((cmd) => cmd.name()),
);

const args = process.argv.slice(2);
const firstArg = args[0];

if (
  firstArg &&
  !firstArg.startsWith('-') &&
  !knownCommands.has(firstArg)
) {
  // Rewrite args to: commit <message> [remaining flags]
  process.argv = [
    process.argv[0],
    process.argv[1],
    'commit',
    ...args,
  ];
}

program.parse();
