import fs from 'node:fs';
import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from '../lib/config.js';
import { apiGet } from '../lib/api-client.js';

interface Lock {
  short_id: string;
  message: string;
  product: { slug: string; name: string };
  feature: { slug: string; name: string };
  author: { name: string };
  scope: 'minor' | 'major' | 'architectural';
  created_at: string;
}

const SCOPE_WEIGHT: Record<string, number> = {
  architectural: 0,
  major: 1,
  minor: 2,
};

const SCOPE_LABEL: Record<string, string> = {
  architectural: 'Architectural',
  major: 'Major',
  minor: 'Minor',
};

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function generateMarkdown(locks: Lock[]): string {
  const productName = locks[0].product.name;
  const today = new Date().toISOString().slice(0, 10);

  // Group by feature
  const byFeature = new Map<string, { name: string; locks: Lock[] }>();
  for (const lock of locks) {
    const key = lock.feature.slug;
    if (!byFeature.has(key)) {
      byFeature.set(key, { name: lock.feature.name, locks: [] });
    }
    byFeature.get(key)!.locks.push(lock);
  }

  const lines: string[] = [];
  lines.push('# Lock — Active Decisions');
  lines.push('');
  lines.push(`Product: **${productName}**`);
  lines.push(`Generated: ${today}`);

  for (const [, group] of byFeature) {
    lines.push('');
    lines.push(`## Feature: ${group.name}`);

    // Group by scope within feature
    const byScope = new Map<string, Lock[]>();
    for (const lock of group.locks) {
      if (!byScope.has(lock.scope)) {
        byScope.set(lock.scope, []);
      }
      byScope.get(lock.scope)!.push(lock);
    }

    // Sort scope groups: architectural > major > minor
    const sortedScopes = [...byScope.entries()].sort(
      ([a], [b]) => (SCOPE_WEIGHT[a] ?? 2) - (SCOPE_WEIGHT[b] ?? 2),
    );

    for (const [scope, scopeLocks] of sortedScopes) {
      lines.push('');
      lines.push(`### ${SCOPE_LABEL[scope] ?? scope}`);
      for (const lock of scopeLocks) {
        lines.push(
          `- **${lock.short_id}**: ${lock.message} *(${lock.author.name}, ${formatDate(lock.created_at)})*`,
        );
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

export const exportCommand = new Command('export')
  .description('Export active decisions to a LOCK.md file')
  .option('--product <slug>', 'Filter by product')
  .option('--feature <slug>', 'Filter by feature')
  .option('--scope <scope>', 'Filter by scope: minor, major, architectural')
  .option('--output <path>', 'Output file path', 'LOCK.md')
  .option('--with-knowledge', 'Include synthesized knowledge sections')
  .action(async (opts) => {
    const config = getConfig();

    const params = new URLSearchParams();
    params.set('status', 'active');
    params.set('limit', '200');

    const product = opts.product ?? config?.product;
    const feature = opts.feature ?? config?.feature;

    if (product) params.set('product', product);
    if (feature) params.set('feature', feature);
    if (opts.scope) params.set('scope', opts.scope);

    const path = `/api/v1/locks?${params.toString()}`;

    try {
      const result = await apiGet<any>(path);
      const locks: Lock[] = result.locks ?? result ?? [];

      if (!Array.isArray(locks) || locks.length === 0) {
        console.log(
          chalk.yellow('No active decisions found. File not written.'),
        );
        return;
      }

      let knowledgeSection = '';
      if (opts.withKnowledge && product) {
        try {
          const kParams = new URLSearchParams();
          kParams.set('product', product);
          if (feature) kParams.set('feature', feature);
          const knowledge = await apiGet<any>(`/api/v1/knowledge?${kParams.toString()}`);
          if (knowledge.facets && knowledge.facets.length > 0) {
            const facetTitles: Record<string, string> = {
              summary: 'Summary',
              principles: 'Principles',
              tensions: 'Tensions & Open Questions',
              trajectory: 'Trajectory',
            };
            const parts: string[] = ['## Knowledge\n'];
            for (const entry of knowledge.facets) {
              parts.push(`### ${facetTitles[entry.facet] ?? entry.facet}\n`);
              parts.push(entry.content);
              parts.push('');
            }
            parts.push('---\n');
            knowledgeSection = parts.join('\n');
          }
        } catch {
          // Knowledge not available — skip
        }
      }

      const markdown = knowledgeSection + generateMarkdown(locks);
      fs.writeFileSync(opts.output, markdown, 'utf-8');
      console.log(
        chalk.green(
          `Exported ${locks.length} active decisions to ${opts.output}`,
        ),
      );
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
