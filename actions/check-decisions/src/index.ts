import * as core from '@actions/core';
import * as github from '@actions/github';

const COMMENT_MARKER = '## 🔒 Related Decisions';

interface LockResult {
  short_id: string;
  message: string;
  scope: string;
  decision_type?: string;
  feature?: { slug: string; name: string };
  created_at: string;
}

async function run(): Promise<void> {
  try {
    const apiUrl = core.getInput('lock-api-url', { required: true });
    const apiKey = core.getInput('lock-api-key', { required: true });
    const product = core.getInput('product') || undefined;
    const threshold = parseInt(core.getInput('comment-threshold') || '1', 10);
    const githubToken = core.getInput('github-token', { required: true });

    const { context } = github;
    const pr = context.payload.pull_request;

    if (!pr) {
      core.info('Not a pull request event. Skipping.');
      return;
    }

    // Build search query from PR title + body
    const title = pr.title || '';
    const body = (pr.body || '').slice(0, 400);
    const query = `${title} ${body}`.trim().slice(0, 500);

    if (!query) {
      core.info('PR has no title or body. Skipping.');
      return;
    }

    // Search Lock API
    const searchBody: Record<string, string> = { query };
    if (product) searchBody.product = product;

    const response = await fetch(`${apiUrl}/api/v1/locks/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      core.warning(`Lock API returned ${response.status}. Skipping decision check.`);
      return;
    }

    const data = await response.json() as { data?: { locks?: LockResult[] } };
    const locks = data.data?.locks || [];

    if (locks.length < threshold) {
      core.info(`Found ${locks.length} decision(s), below threshold of ${threshold}. No comment posted.`);
      return;
    }

    // Format comment
    const lines: string[] = [];
    lines.push(COMMENT_MARKER);
    lines.push('');
    lines.push(`Found **${locks.length}** relevant decision${locks.length === 1 ? '' : 's'} in Lock:`);
    lines.push('');

    for (const lock of locks) {
      const scopeBadge = lock.scope === 'architectural' ? '🔴' : lock.scope === 'major' ? '🟠' : '🔵';
      const typeBadge = lock.decision_type ? ` \`${lock.decision_type}\`` : '';
      const feature = lock.feature?.name || '';
      const date = lock.created_at ? lock.created_at.slice(0, 10) : '';
      lines.push(`- \`${lock.short_id}\` ${scopeBadge} **${lock.scope}**${typeBadge} ${lock.message} _(${feature}, ${date})_`);
    }

    lines.push('');
    lines.push('_Posted by [Lock](https://github.com/uselock/lock) — the decision protocol for product teams_');

    const commentBody = lines.join('\n');

    // Post or update comment
    const octokit = github.getOctokit(githubToken);
    const { owner, repo } = context.repo;
    const prNumber = pr.number;

    // Find existing comment
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    const existing = comments.find((c) => c.body?.startsWith(COMMENT_MARKER));

    if (existing) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body: commentBody,
      });
      core.info(`Updated existing Lock comment on PR #${prNumber}`);
    } else {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody,
      });
      core.info(`Posted Lock comment on PR #${prNumber}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.warning(`Lock decision check failed: ${error.message}`);
    }
  }
}

run();
