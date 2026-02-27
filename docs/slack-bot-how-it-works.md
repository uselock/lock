# How Lock Sees and Answers in Slack (for Agents)

This doc explains how the Lock Slack bot is able to **see** messages and **respond** when you invite it to a channel and talk to it. Use it when debugging or extending the Slack integration.

---

## 1. How Lock Gets “Invited” and Receives Messages

- **Bot user**: Lock is a Slack **Bot User** (see `slack-app-manifest.yml`: `display_name: Lock`). When you invite `@Lock` to a channel, the bot is added to that channel and can receive events for it.
- **Socket Mode (no public URL)**: The app uses **Socket Mode** (`socketMode: true` in `packages/slack/src/index.ts`). Slack keeps a WebSocket open to the app; the app does **not** expose an HTTP endpoint. Env: `SLACK_APP_TOKEN` (xapp-…) with `connections:write`; `SLACK_BOT_TOKEN` (xoxb-…); `SLACK_SIGNING_SECRET`.
- **Only @mentions**: Lock does **not** receive every channel message. The app subscribes to the **`app_mention`** event (manifest: `bot_events: - app_mention`). So Slack only sends an event when someone **mentions** the bot, e.g. `@lock log` or `@lock Use notional value`. That’s why “talking to Lock” means **mentioning** `@lock` with a command or message.

**Flow**: User types `@lock log` in a channel → Slack sends an `app_mention` event over the Socket Mode connection → Bolt receives it and runs the handler.

---

## 2. How Lock “Sees” the Conversation (Thread Context)

When the mention happens **in a thread**, the event includes `thread_ts`. The handler then loads the thread content via the Slack API:

- **Where**: `packages/slack/src/commands/lock.ts` (and other handlers that need context) call `getThreadContext(client, channelId, threadTs)` from `packages/slack/src/lib/thread-context.ts`.
- **What it does**:
  - `client.conversations.replies({ channel, ts: threadTs, inclusive: true })` — fetches all messages in that thread.
  - Resolves user IDs to display names (`users.info`), builds a text snippet from the last 5 messages, and gets the thread permalink.
- **Why**: So Lock can “see” the thread for **extract** mode (`@lock this`) and **polish** mode (`@lock the fact that ...`), and for attaching context to committed decisions. For **explicit** commits in a thread (e.g. `@lock we go with option A`), Lock enriches the message using the thread: it resolves shorthand (e.g. "option A" → the actual option text), adds topic and ticket/ID from the thread, then commits.

Lock does **not** receive or store channel messages unless they are part of a thread where Lock was @mentioned and the handler explicitly fetches that thread.

---

## 3. How Lock Answers

- **Entry point**: `packages/slack/src/index.ts` registers `app.event('app_mention', async ({ event, client, say }) => { ... })`.
- **Parse**: The raw mention `text` (e.g. `"<@U123> log"`) is parsed with `parseCommand(text)` in `packages/slack/src/lib/parser.ts`: strip `<@U...>`, tokenize, detect subcommand (`init`, `log`, `commit`, …) and flags (`--scope`, `--product`, …), and for commit, detect mode (explicit / extract / polish).
- **Dispatch**: A switch on `command.subcommand` calls the right handler (e.g. `handleLock`, `handleLog`, `handleInit`) in `packages/slack/src/commands/`. Each handler uses `callApi(...)` to talk to the Lock Core API (with `X-Internal-Secret` and `X-Workspace-Team-Id` for auth).
- **Reply**: The handler returns Block Kit `blocks`. The main handler then calls `say({ blocks, text: 'Lock response', thread_ts: threadTs || event.ts })`. So the reply is **in the same thread** if the mention was in a thread, otherwise a reply to the message — so the user sees Lock’s answer right where they asked.

---

## 4. Channel → Product/Feature (Why @lock init Matters)

Lock needs a **product** (and optionally **feature**) for commits. That’s resolved from the **channel**:

- **Channel config**: Core API has `channel-configs` that map `slackChannelId` → `productId` / `featureId`. When you run `@lock init --product <p> --feature <f>` in a channel, that channel is linked.
- **In handleLock**: The first thing `handleLock` does is `GET /api/v1/channel-configs/${channelId}`. If the channel isn’t configured, it tells you to run `@lock init --product <product>` first.

So: invite Lock → run `@lock init` in that channel once → then `@lock <message>` or `@lock log` etc. work there.

---

## 5. Checklist for “Invite Lock and Talk to Him”

1. **App created and installed**: Create app from `slack-app-manifest.yml`, install to workspace, copy Bot Token, Signing Secret, and **App-Level Token** (with `connections:write`) into `.env`.
2. **Env**: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`; optionally `LOCK_API_URL`, `INTERNAL_SECRET` (for Core API).
3. **Run the app**: `pnpm dev` or `pnpm dev:slack` so that `app.start(SLACK_PORT)` runs and the Socket Mode connection is open.
4. **Invite the bot**: In Slack, invite `@Lock` to the channel.
5. **Init channel**: In that channel, run `@lock init --product <slug> --feature <slug>` (or product only).
6. **Talk to Lock**: Mention `@lock` with a command or message, e.g. `@lock log`, `@lock We use notional value here`. Lock will see the mention, parse it, (in a thread) load thread context, call the Core API, and reply in the same thread/channel.

---

## 6. File Reference

| What | Where |
|------|--------|
| Bolt app, Socket Mode, `app_mention` handler | `packages/slack/src/index.ts` |
| Parse @lock text → subcommand + flags + mode | `packages/slack/src/lib/parser.ts` |
| Fetch thread messages and build snippet | `packages/slack/src/lib/thread-context.ts` |
| Handle @lock &lt;message&gt; (commit / extract / polish) | `packages/slack/src/commands/lock.ts` |
| Other commands (log, init, revert, …) | `packages/slack/src/commands/*.ts` |
| Scopes and `app_mention` subscription | `slack-app-manifest.yml` |
