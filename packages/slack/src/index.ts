import 'dotenv/config';
import { App, LogLevel } from '@slack/bolt';
import { parseCommand } from './lib/parser.js';
import { handleInit } from './commands/init.js';
import { handleLock } from './commands/lock.js';
import { handleLog } from './commands/log.js';
import { handleProducts } from './commands/products.js';
import { handleFeatures } from './commands/features.js';
import { handleRevert } from './commands/revert.js';
import { handleLink } from './commands/link.js';
import { handleSearch } from './commands/search.js';
import { handleRecap } from './commands/recap.js';
import { formatError } from './lib/formatters.js';
import { registerConfirmCommit } from './actions/confirm-commit.js';
import { registerEditDecision } from './actions/edit-decision.js';
import { registerCancelExtract } from './actions/cancel-extract.js';
import { registerChangeScope } from './actions/change-scope.js';
import { registerAddLink } from './actions/add-link.js';
import { registerAddTags } from './actions/add-tags.js';

const LOCK_API_URL = process.env.LOCK_API_URL || 'http://localhost:3000';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';
const SLACK_PORT = parseInt(process.env.SLACK_PORT || '3001', 10);

// Initialize the Bolt app with socket mode for development
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
});

/**
 * Helper to call the Lock Core API.
 *
 * Wraps fetch with the base URL, internal auth headers, and
 * workspace team ID for tenant resolution.
 */
async function callApi(
  method: string,
  path: string,
  body?: any,
  teamId?: string,
): Promise<any> {
  const url = `${LOCK_API_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (INTERNAL_SECRET) {
    headers['X-Internal-Secret'] = INTERNAL_SECRET;
  }

  if (teamId) {
    headers['X-Workspace-Team-Id'] = teamId;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    return { error: data.error || { code: 'API_ERROR', message: `API returned ${response.status}` } };
  }

  return data;
}

// Listen for @lock mentions
app.event('app_mention', async ({ event, client, say }) => {
  const { text, channel: channelId, thread_ts: threadTs } = event;
  const userId = event.user ?? 'unknown';
  const teamId = event.team ?? '';

  // Resolve the user's display name
  let userName = userId;
  try {
    const userInfo = await client.users.info({ user: userId });
    userName =
      userInfo.user?.profile?.display_name ||
      userInfo.user?.real_name ||
      userInfo.user?.name ||
      userId;
  } catch {
    // Fall back to user ID if we can't resolve
  }

  // Parse the command
  const command = parseCommand(text);

  // Create a team-scoped callApi wrapper
  const teamCallApi = (method: string, path: string, body?: any) =>
    callApi(method, path, body, teamId);

  let blocks: any[];

  try {
    switch (command.subcommand) {
      case 'init':
        blocks = await handleInit(command, channelId, teamCallApi);
        break;

      case 'commit':
        blocks = await handleLock(command, {
          channelId,
          userId,
          userName,
          teamId: teamId || '',
          threadTs,
          client,
          callApi: teamCallApi,
        });
        break;

      case 'log':
        blocks = await handleLog(command, teamCallApi);
        break;

      case 'products':
        blocks = await handleProducts(command, teamCallApi);
        break;

      case 'features':
        blocks = await handleFeatures(command, teamCallApi);
        break;

      case 'revert':
        blocks = await handleRevert(command, userId, userName, teamCallApi);
        break;

      case 'link':
        blocks = await handleLink(command, teamCallApi);
        break;

      case 'search':
        blocks = await handleSearch(command, teamCallApi);
        break;

      case 'recap':
        blocks = await handleRecap(command, channelId, teamCallApi);
        break;

      case 'describe':
        blocks = await handleDescribe(command, teamCallApi);
        break;

      default:
        blocks = formatError('UNKNOWN_COMMAND', `Unknown command: \`${command.subcommand}\``);
    }
  } catch (err: any) {
    console.error('Error handling command:', err);
    blocks = formatError('INTERNAL_ERROR', err.message || 'An unexpected error occurred.');
  }

  // Reply in thread if the mention was in a thread, otherwise reply in channel
  await say({
    blocks,
    text: 'Lock response', // Fallback text for notifications
    thread_ts: threadTs || event.ts,
  });
});

/**
 * Handle `@lock describe --product <p> "description"` or
 * `@lock describe --feature <f> "description"`.
 *
 * Updates the description of a product or feature.
 */
async function handleDescribe(command: any, callApi: Function): Promise<any[]> {
  const { product, feature } = command.flags;
  const description = command.message;

  if (!description) {
    return formatError(
      'MISSING_DESCRIPTION',
      'Please provide a description.\nUsage: `@lock describe --product <slug> "description"` or `@lock describe --feature <slug> "description"`',
    );
  }

  if (feature) {
    try {
      const response = await callApi('PATCH', `/api/v1/features/${feature}`, { description });
      if (response.error) {
        return formatError(response.error.code || 'DESCRIBE_FAILED', response.error.message);
      }
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:white_check_mark: Updated description for feature \`${feature}\`:\n> ${description}`,
          },
        },
      ];
    } catch (err: any) {
      return formatError('DESCRIBE_FAILED', err.message || 'Failed to update feature description.');
    }
  }

  if (product) {
    try {
      const response = await callApi('PATCH', `/api/v1/products/${product}`, { description });
      if (response.error) {
        return formatError(response.error.code || 'DESCRIBE_FAILED', response.error.message);
      }
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:white_check_mark: Updated description for product \`${product}\`:\n> ${description}`,
          },
        },
      ];
    } catch (err: any) {
      return formatError('DESCRIBE_FAILED', err.message || 'Failed to update product description.');
    }
  }

  return formatError(
    'MISSING_TARGET',
    'Please specify `--product <slug>` or `--feature <slug>` to describe.\nUsage: `@lock describe --product trading "Core trading platform"`',
  );
}

// Register interactive action handlers
// Use a non-team-scoped callApi for action handlers (team ID comes from the action context)
const globalCallApi = (method: string, path: string, body?: any) =>
  callApi(method, path, body);

registerConfirmCommit(app, globalCallApi);
registerEditDecision(app, globalCallApi);
registerCancelExtract(app);
registerChangeScope(app, globalCallApi);
registerAddLink(app, globalCallApi);
registerAddTags(app, globalCallApi);

// Start the app
(async () => {
  await app.start(SLACK_PORT);
  console.log(`Lock Slack bot is running on port ${SLACK_PORT}`);
  console.log(`Core API: ${LOCK_API_URL}`);
})();
