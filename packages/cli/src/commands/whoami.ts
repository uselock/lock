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
    const prefix = creds.api_key.slice(0, 8);

    console.log(`  ${chalk.dim('API URL:')} ${creds.api_url}`);
    console.log(`  ${chalk.dim('Key:')}     ${prefix}...`);

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
