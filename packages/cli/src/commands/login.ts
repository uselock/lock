import { Command } from 'commander';
import chalk from 'chalk';
import { input, password, confirm } from '@inquirer/prompts';
import { credentialsExist, getCredentials, saveCredentials } from '../lib/credentials.js';

export const loginCommand = new Command('login')
  .description('Authenticate the CLI with a Lock server')
  .option('--url <url>', 'Lock API URL')
  .option('--key <key>', 'API key')
  .action(async (opts) => {
    try {
      let { url, key } = opts as { url?: string; key?: string };

      // Check if already logged in
      if (credentialsExist()) {
        const existing = await getCredentials();
        const prefix = existing.api_key.slice(0, 8);
        console.log(chalk.yellow(`Already logged in to ${existing.api_url} (key: ${prefix}...)`));

        if (!url && !key) {
          const overwrite = await confirm({
            message: 'Overwrite existing credentials?',
            default: false,
          });
          if (!overwrite) {
            console.log(chalk.dim('Login cancelled.'));
            return;
          }
        }
      }

      // Interactive prompts if flags not provided
      if (!url) {
        url = await input({
          message: 'Lock API URL:',
          default: 'http://localhost:3000',
        });
      }

      if (!key) {
        key = await password({
          message: 'API key:',
          mask: '*',
        });
      }

      // Validate credentials by calling the API directly (not apiGet, which auto-prompts)
      console.log(chalk.dim('Validating credentials...'));

      let response: Response;
      try {
        response = await fetch(`${url}/api/v1/products`, {
          headers: { 'Authorization': `Bearer ${key}` },
        });
      } catch (err: any) {
        if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
          console.error(chalk.red(`Cannot reach server at ${url}`));
          console.error(chalk.dim('Is the Lock API running?'));
          process.exit(1);
        }
        throw err;
      }

      if (response.status === 401) {
        console.error(chalk.red('Invalid API key.'));
        process.exit(1);
      }

      if (!response.ok) {
        console.error(chalk.red(`Server returned ${response.status}`));
        process.exit(1);
      }

      // Save credentials
      await saveCredentials({ api_url: url, api_key: key });

      const prefix = key.slice(0, 8);
      console.log('');
      console.log(chalk.green('Logged in successfully.'));
      console.log(`  ${chalk.dim('API URL:')} ${url}`);
      console.log(`  ${chalk.dim('Key:')}     ${prefix}...`);

      // Show workspace products
      const json = await response.json() as { data?: any };
      const products = json.data?.products ?? json.data ?? [];
      if (Array.isArray(products) && products.length > 0) {
        console.log(`  ${chalk.dim('Products:')} ${products.map((p: any) => p.slug ?? p.name).join(', ')}`);
      }

      console.log('');
      console.log(chalk.dim('Credentials saved to ~/.lock/credentials'));
    } catch (err: any) {
      if (err.name === 'ExitPromptError') {
        console.log(chalk.dim('Login cancelled.'));
        return;
      }
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
