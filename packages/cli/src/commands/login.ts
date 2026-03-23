import { Command } from 'commander';
import chalk from 'chalk';
import { select, input, password, confirm } from '@inquirer/prompts';
import { credentialsExist, getCredentials, saveCredentials } from '../lib/credentials.js';

const DEFAULT_API_URL = 'https://api.uselock.ai';

async function apiKeyLogin(url: string, key: string): Promise<void> {
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

  await saveCredentials({ api_url: url, api_key: key });

  const prefix = key.slice(0, 8);
  console.log('');
  console.log(chalk.green('Logged in successfully.'));
  console.log(`  ${chalk.dim('API URL:')} ${url}`);
  console.log(`  ${chalk.dim('Key:')}     ${prefix}...`);

  const json = await response.json() as { data?: any };
  const products = json.data?.products ?? json.data ?? [];
  if (Array.isArray(products) && products.length > 0) {
    console.log(`  ${chalk.dim('Products:')} ${products.map((p: any) => p.slug ?? p.name).join(', ')}`);
  }

  console.log('');
  console.log(chalk.dim('Credentials saved to ~/.lock/credentials'));
}

export const loginCommand = new Command('login')
  .description('Authenticate the CLI with a Lock server')
  .option('--url <url>', 'Lock API URL (for self-hosted)')
  .option('--key <key>', 'API key (for self-hosted)')
  .action(async (opts) => {
    try {
      let { url, key } = opts as { url?: string; key?: string };

      // Check if browser login (device flow) is available
      let hasDeviceFlow = false;
      let deviceFlowLogin: ((apiUrl: string) => Promise<void>) | undefined;
      try {
        const mod = await import('../lib/device-flow.js');
        deviceFlowLogin = mod.deviceFlowLogin;
        hasDeviceFlow = true;
      } catch {
        // device flow not available (open-source distribution)
      }

      // Check if already logged in
      if (credentialsExist()) {
        const existing = await getCredentials();
        const authLabel = existing.api_key
          ? `key: ${existing.api_key.slice(0, 8)}...`
          : 'browser auth';
        console.log(chalk.yellow(`Already logged in to ${existing.api_url} (${authLabel})`));

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

      // If --key is provided (with or without --url), use API key flow
      if (key) {
        if (!url) {
          url = DEFAULT_API_URL;
        }
        await apiKeyLogin(url, key);
        return;
      }

      // No flags or --url only -> show auth method selection
      if (hasDeviceFlow) {
        const method = await select({
          message: 'How would you like to authenticate?',
          choices: [
            { name: 'Login with browser (recommended)', value: 'browser' },
            { name: 'Enter API key (self-hosted)', value: 'apikey' },
          ],
        });

        if (method === 'browser') {
          if (!url) {
            url = DEFAULT_API_URL;
          }
          await deviceFlowLogin!(url);
        } else {
          if (!url) {
            url = await input({
              message: 'Lock API URL:',
              default: DEFAULT_API_URL,
            });
          }
          key = await password({
            message: 'API key:',
            mask: '*',
          });
          await apiKeyLogin(url, key);
        }
      } else {
        // No device flow available, go straight to API key input
        if (!url) {
          url = await input({
            message: 'Lock API URL:',
            default: DEFAULT_API_URL,
          });
        }
        key = await password({
          message: 'API key:',
          mask: '*',
        });
        await apiKeyLogin(url, key);
      }
    } catch (err: any) {
      if (err.name === 'ExitPromptError') {
        console.log(chalk.dim('Login cancelled.'));
        return;
      }
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
