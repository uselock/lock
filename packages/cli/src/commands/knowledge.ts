import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from '../lib/config.js';
import { apiGet, apiPost } from '../lib/api-client.js';

interface KnowledgeEntry {
  facet: string;
  content: string;
  version: number;
  lock_count_at_generation: number;
  updated_at: string;
}

interface KnowledgeResult {
  product: { slug: string; name: string };
  feature?: { slug: string; name: string };
  facets: KnowledgeEntry[];
  message?: string;
}

const FACET_TITLES: Record<string, string> = {
  summary: 'Summary',
  principles: 'Principles',
  tensions: 'Tensions & Open Questions',
  trajectory: 'Trajectory',
};

const FACET_COLORS: Record<string, (s: string) => string> = {
  summary: chalk.blue,
  principles: chalk.green,
  tensions: chalk.yellow,
  trajectory: chalk.magenta,
};

export const knowledgeCommand = new Command('knowledge')
  .description('Show synthesized knowledge about a product or feature')
  .option('--product <slug>', 'Product slug')
  .option('--feature <slug>', 'Feature slug')
  .option('--regenerate', 'Force full regeneration from all decisions')
  .action(async (opts) => {
    const config = getConfig();

    const product = opts.product ?? config?.product;
    const feature = opts.feature ?? config?.feature;

    if (!product) {
      console.error(chalk.red('Error: --product is required (or run `lock init` to set a default)'));
      process.exit(1);
    }

    try {
      let result: KnowledgeResult;

      if (opts.regenerate) {
        result = await apiPost<KnowledgeResult>('/api/v1/knowledge/regenerate', {
          product,
          feature,
        });
      } else {
        const params = new URLSearchParams();
        params.set('product', product);
        if (feature) params.set('feature', feature);
        result = await apiGet<KnowledgeResult>(`/api/v1/knowledge?${params.toString()}`);
      }

      if (result.message) {
        console.log(chalk.yellow(result.message));
        return;
      }

      if (!result.facets || result.facets.length === 0) {
        const scope = feature
          ? `${result.product?.name ?? product} / ${result.feature?.name ?? feature}`
          : result.product?.name ?? product;
        console.log(chalk.yellow(`No knowledge synthesized yet for ${scope}. Commit some decisions first.`));
        return;
      }

      const scope = result.feature
        ? `${result.product.name} / ${result.feature.name}`
        : result.product.name;

      console.log('');
      console.log(chalk.bold(`Knowledge — ${scope}`));
      console.log('');

      for (const entry of result.facets) {
        const title = FACET_TITLES[entry.facet] ?? entry.facet;
        const colorFn = FACET_COLORS[entry.facet] ?? chalk.white;

        console.log(colorFn(chalk.bold(`  ${title}`)));
        console.log('');
        // Indent each line of content
        const lines = entry.content.split('\n');
        for (const line of lines) {
          console.log(`    ${line}`);
        }
        console.log('');
      }

      // Metadata footer
      const first = result.facets[0];
      if (first) {
        const date = new Date(first.updated_at).toLocaleDateString();
        console.log(chalk.dim(`  v${first.version} | ${first.lock_count_at_generation} decisions | Updated ${date}`));
      }
      console.log('');
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
