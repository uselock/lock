import { Command } from 'commander';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { credentialsExist, deleteCredentials } from '../lib/credentials.js';

export const logoutCommand = new Command('logout')
  .description('Remove stored credentials')
  .option('--force', 'Skip confirmation prompt')
  .action(async (opts) => {
    try {
      const { force } = opts as { force?: boolean };

      if (!credentialsExist()) {
        console.log(chalk.dim('Not logged in.'));
        return;
      }

      if (!force) {
        const ok = await confirm({
          message: 'Remove stored credentials?',
          default: false,
        });
        if (!ok) {
          console.log(chalk.dim('Logout cancelled.'));
          return;
        }
      }

      deleteCredentials();
      console.log(chalk.green('Logged out. Credentials removed.'));
    } catch (err: any) {
      if (err.name === 'ExitPromptError') {
        console.log(chalk.dim('Logout cancelled.'));
        return;
      }
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
