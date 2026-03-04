import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { select, input, confirm } from '@inquirer/prompts';
import { saveConfig } from '../lib/config.js';
import { apiGet } from '../lib/api-client.js';

const CREATE_NEW = '__create_new__';

const LOCK_SKILL_TEMPLATE = `---
name: lock
description: Record product decisions before building. Checks for existing constraints.
---

# Lock Decision Protocol

You are about to record one or more product decisions using Lock.

## Steps

1. **Identify decisions** in the current context. A decision is: choosing between approaches,
   establishing a convention, setting a constraint, or reversing a previous decision.
   NOT a decision: bug fixes, refactors, routine implementation.

2. **Check for conflicts** — call \`lock_check\` with a summary of what you're about to build.
   Review any blocking decisions before proceeding.

3. **Record each decision** — call \`lock_commit\` with:
   - A clear, standalone statement (readable in 3 months without context)
   - Scope: \`minor\` (default), \`major\` (cross-feature), or \`architectural\` (system-wide)
   - Relevant tags if obvious

4. **Report** — show the user what was locked with short IDs.

## When to use

- When the user approves a plan or feature before you build it
- When the user asks to lock or record a decision
- When you agree on an approach that represents a product or technical choice
`;

const MCP_SERVER_CONFIG = {
  command: 'npx',
  args: ['@uselock/mcp'],
};

export const initCommand = new Command('init')
  .description('Initialize this directory with a product and feature scope')
  .option('--product <slug>', 'Product slug (e.g. "trading")')
  .option('--feature <slug>', 'Feature slug (e.g. "margin-rework")')
  .option('--skip-ide', 'Skip IDE auto-detection and setup')
  .action(async (opts) => {
    let { product, feature } = opts as { product?: string; feature?: string };
    const skipIde = opts.skipIde as boolean | undefined;

    try {
      // If product provided (with or without feature), use non-interactive flow
      if (product) {
        try {
          await apiGet('/api/v1/products');
        } catch {
          console.log(chalk.yellow('Warning: Could not reach the Lock API. Config will be saved locally anyway.'));
        }

        saveConfig(feature ? { product, feature } : { product });
        printSuccess(product, feature);

        if (!skipIde) {
          await setupIde();
        }
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
      printSuccess(product, feature!);

      if (!skipIde) {
        await setupIde();
      }
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

function printSuccess(product: string, feature?: string): void {
  console.log(chalk.green('Initialized Lock in this directory.'));
  console.log(`  ${chalk.dim('Product:')} ${product}`);
  console.log(`  ${chalk.dim('Feature:')} ${feature || 'main (default)'}`);
  console.log('');
  console.log(chalk.dim('Config saved to .lock/config.json'));
}

async function setupIde(): Promise<void> {
  const cwd = process.cwd();

  const ides = [
    {
      name: 'Claude Code',
      markerDir: '.claude',
      mcpConfigPath: path.join(cwd, '.mcp.json'),
      skill: { dir: path.join(cwd, '.claude', 'skills'), file: 'lock.md', content: LOCK_SKILL_TEMPLATE },
    },
    {
      name: 'Cursor',
      markerDir: '.cursor',
      mcpConfigPath: path.join(cwd, '.cursor', 'mcp.json'),
    },
  ];

  for (const ide of ides) {
    if (!fs.existsSync(path.join(cwd, ide.markerDir))) continue;

    console.log('');
    console.log(`${chalk.blue(ide.name)} detected.`);

    const shouldSetup = await confirm({
      message: `Set up Lock for ${ide.name}?`,
      default: true,
    });

    if (!shouldSetup) continue;

    writeMcpConfig(ide.mcpConfigPath);
    console.log(chalk.green(`  ✓ Added Lock MCP server to ${path.relative(cwd, ide.mcpConfigPath)}`));

    if (ide.skill) {
      fs.mkdirSync(ide.skill.dir, { recursive: true });
      fs.writeFileSync(path.join(ide.skill.dir, ide.skill.file), ide.skill.content);
      console.log(chalk.green(`  ✓ Installed decision protocol to ${path.relative(cwd, path.join(ide.skill.dir, ide.skill.file))}`));
    }
  }
}

function writeMcpConfig(filePath: string): void {
  let config: any = {};

  // Merge with existing config if present
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    config = JSON.parse(raw);
  } catch {
    // File doesn't exist or is invalid — start fresh
  }

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  config.mcpServers.lock = MCP_SERVER_CONFIG;

  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
}
