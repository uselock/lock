import { Command } from 'commander';
import chalk from 'chalk';
import { select, input } from '@inquirer/prompts';
import { saveConfig } from '../lib/config.js';
import { apiGet } from '../lib/api-client.js';

const CREATE_NEW = '__create_new__';

export const initCommand = new Command('init')
  .description('Initialize this directory with a product and feature scope')
  .option('--product <slug>', 'Product slug (e.g. "trading")')
  .option('--feature <slug>', 'Feature slug (e.g. "margin-rework")')
  .action(async (opts) => {
    let { product, feature } = opts as { product?: string; feature?: string };

    try {
      // If both flags provided, use the original non-interactive flow
      if (product && feature) {
        try {
          await apiGet('/api/v1/products');
        } catch {
          console.log(chalk.yellow('Warning: Could not reach the Lock API. Config will be saved locally anyway.'));
        }

        saveConfig({ product, feature });
        printSuccess(product, feature);
        return;
      }

      // Interactive flow — need API access
      let products: any[];
      try {
        products = await apiGet<any>('/api/v1/products') as any;
        // Normalize: API may return { products: [...] } or [...]
        if (!Array.isArray(products)) {
          products = (products as any).products ?? [];
        }
      } catch {
        console.error(chalk.red('Cannot reach Lock API. Use `lock init --product <slug> --feature <slug>` to initialize manually.'));
        process.exit(1);
      }

      // Select or create product
      if (!product) {
        const productChoices = products.map((p: any) => {
          const count = p.lock_count ?? p.lockCount ?? 0;
          return {
            name: `${p.name} (${p.slug}) — ${count} lock${count === 1 ? '' : 's'}`,
            value: p.slug as string,
          };
        });
        productChoices.push({ name: 'Create new product', value: CREATE_NEW });

        product = await select({
          message: 'Select a product:',
          choices: productChoices,
        });

        if (product === CREATE_NEW) {
          product = await input({
            message: 'Product slug (url-safe, e.g. "trading"):',
            validate: (v) => v.trim().length > 0 || 'Slug is required',
          });
          const name = await input({
            message: 'Display name:',
            default: product,
          });
          // Auto-create happens on first lock commit, but we can try to create now
          try {
            await apiGet(`/api/v1/products`); // just verify connectivity
          } catch { /* ignore */ }
          console.log(chalk.dim(`Product "${name}" (${product}) will be created on first lock commit.`));
        }
      }

      // Fetch features for selected product
      if (!feature) {
        let features: any[];
        try {
          features = await apiGet<any>(`/api/v1/features?product=${product}`) as any;
          if (!Array.isArray(features)) {
            features = (features as any).features ?? [];
          }
        } catch {
          features = [];
        }

        const featureChoices = features.map((f: any) => {
          const count = f.lock_count ?? f.lockCount ?? 0;
          return {
            name: `${f.name} (${f.slug}) — ${count} lock${count === 1 ? '' : 's'}`,
            value: f.slug as string,
          };
        });
        featureChoices.push({ name: 'Create new feature', value: CREATE_NEW });

        feature = await select({
          message: 'Select a feature:',
          choices: featureChoices,
        });

        if (feature === CREATE_NEW) {
          feature = await input({
            message: 'Feature slug (url-safe, e.g. "margin-rework"):',
            validate: (v) => v.trim().length > 0 || 'Slug is required',
          });
          const name = await input({
            message: 'Display name:',
            default: feature,
          });
          console.log(chalk.dim(`Feature "${name}" (${feature}) will be created on first lock commit.`));
        }
      }

      saveConfig({ product, feature });
      printSuccess(product, feature);
    } catch (err: any) {
      // Handle user cancellation (Ctrl+C in prompts)
      if (err.name === 'ExitPromptError') {
        console.log(chalk.dim('Init cancelled.'));
        return;
      }
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

function printSuccess(product: string, feature: string): void {
  console.log(chalk.green('Initialized Lock in this directory.'));
  console.log(`  ${chalk.dim('Product:')} ${product}`);
  console.log(`  ${chalk.dim('Feature:')} ${feature}`);
  console.log('');
  console.log(chalk.dim('Config saved to .lock/config.json'));
}
