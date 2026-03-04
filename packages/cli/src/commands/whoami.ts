import { Command } from 'commander';
import chalk from 'chalk';
import { credentialsExist, getCredentials } from '../lib/credentials.js';

export const whoamiCommand = new Command('whoami')
  .description('Show current credentials and connection status')
  .action(async () => {
    if (!credentialsExist()) {
      console.log(chalk.yellow('Not logged in.'));
      console.log(chalk.dim('Run `lock login` to authenticate.'));
      return;
    }

    const creds = await getCredentials();

    if (creds.name || creds.email) {
      console.log(`  ${chalk.dim('Account:')} ${creds.name ?? creds.email}`);
      if (creds.name && creds.email) {
        console.log(`  ${chalk.dim('Email:')}   ${creds.email}`);
      }
    }
    console.log(`  ${chalk.dim('API URL:')} ${creds.api_url}`);
    if (creds.api_key) {
      console.log(`  ${chalk.dim('Key:')}     ${creds.api_key.slice(0, 8)}...`);
    } else if (creds.access_token) {
      console.log(`  ${chalk.dim('Auth:')}    browser login`);
    }
    if (creds.workspace_id) {
      console.log(`  ${chalk.dim('Workspace:')} ${creds.workspace_id}`);
    }

    // Check connection status
    try {
      const res = await fetch(`${creds.api_url}/health`);
      if (res.ok) {
        console.log(`  ${chalk.dim('Status:')}  ${chalk.green('connected')}`);
      } else {
        console.log(`  ${chalk.dim('Status:')}  ${chalk.red('server returned ' + res.status)}`);
      }
    } catch {
      console.log(`  ${chalk.dim('Status:')}  ${chalk.red('unreachable')}`);
    }
  });
