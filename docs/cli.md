# CLI

The Lock CLI integrates decision tracking into your developer workflow. Record decisions, check for existing constraints before coding, and browse your team's decision log — all from the terminal.

## Installation

```bash
npm install -g @uselock/cli
```

Requires Node.js 20 or later.

## Authentication

On first use, Lock prompts you for your API URL and key:

```
$ lock log
Lock API URL: (http://localhost:3000) https://your-lock-instance.com
API key: ************************************
Credentials saved to ~/.lock/credentials
```

Credentials are stored in `~/.lock/credentials` with restrictive file permissions (0600). The file contains:

```json
{
  "api_url": "https://your-lock-instance.com",
  "api_key": "lk_a7f3e2..."
}
```

## Project Setup

Initialize a directory with a product and feature scope:

```bash
lock init --product trading --feature margin-rework
```

This creates `.lock/config.json`:

```json
{
  "product": "trading",
  "feature": "margin-rework"
}
```

After initializing, you can omit `--product` and `--feature` from most commands — Lock reads them from the config.

### Interactive Init

Run `lock init` without flags for an interactive experience:

```
$ lock init

? Select a product:
  Trading (trading) — 12 locks
  Risk Engine (risk-engine) — 5 locks
> Create new product

? Product slug (url-safe, e.g. "trading"): payments
? Display name: Payments

? Select a feature:
> Create new feature

? Feature slug (url-safe, e.g. "margin-rework"): checkout-v2
? Display name: Checkout v2

Initialized Lock in this directory.
  Product: payments
  Feature: checkout-v2
```

You can also provide just one flag and Lock will prompt for the other:

```bash
lock init --product trading    # prompts for feature selection
```

---

## Commands

### `lock commit <message>` — Record a Decision

```bash
lock commit "Use Redis for session caching"
lock commit "Migrate to PostgreSQL 16" --scope architectural --tag infrastructure
lock commit "Add rate limiting to public API" --scope major --ticket API-789
```

**Shorthand:** You can omit `commit` — any unrecognized first argument is treated as a message:

```bash
lock "Use Redis for session caching"
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--scope <scope>` | `minor`, `major`, or `architectural` | `minor` |
| `--tag <tag>` | Add a tag (repeatable) | — |
| `--ticket <ID>` | Jira ticket reference | — |

**Requires:** `.lock/config.json` in the current directory. Run `lock init` first.

**Output:** Shows the committed lock with its short ID, and any detected conflicts or supersessions.

---

### `lock check <intent>` — Check Before You Build

Search for existing decisions relevant to what you're about to work on. Run this before starting a task to understand existing constraints.

```bash
lock check "refactor position display to show PnL"
lock check "margin calculations" --product trading
```

**Options:**

| Option | Description |
|--------|-------------|
| `--product <slug>` | Scope search to a product |
| `--feature <slug>` | Scope search to a feature |

**Output:**

```
Relevant decisions:

1. [major] l-a7f3e2: Use notional value instead of margin for position display
   Feature: margin-rework | Author: philippe | 2/15/2026

2. [minor] l-b8c4f1: PnL calculations should use end-of-day prices
   Feature: position-display | Author: alice | 2/10/2026

If your work contradicts a decision, use `lock commit` to record a superseding decision.
```

If no relevant decisions are found:

```
No relevant decisions found. Proceed as planned.
```

---

### `lock log` — Browse Decisions

List recent locks with optional filtering.

```bash
lock log
lock log --product trading
lock log --feature margin-rework
lock log --scope major
lock log --status active
lock log --limit 50
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--product <slug>` | Filter by product (uses config default) | config |
| `--feature <slug>` | Filter by feature | — |
| `--scope <scope>` | Filter by scope | — |
| `--status <status>` | Filter by status | — |
| `--limit <n>` | Max results | 20 |

---

### `lock show <id>` — View Decision Details

Display full details of a specific lock.

```bash
lock show l-a7f3e2
```

**Output:**

```
l-a7f3e2 [major] active
  Use notional value instead of margin for position display

  Product: Trading  Feature: Margin Rework
  Author:  philippe via slack
  Date:    2/15/2026, 2:30:00 PM

  Tags:    #display #margin

  Links:   jira: TRADE-442

  Context:
    philippe: what should we use for the position display?
    alice: I think notional value makes more sense than margin
    philippe: agreed, let's go with that

  Source:  https://myteam.slack.com/archives/C123/p456

  Lineage:
    Supersedes: l-x9y2z3
```

---

### `lock search <query>` — Semantic Search

Find decisions by meaning using natural language.

```bash
lock search "how do we handle margin calculations"
lock search "authentication approach" --product platform
```

**Options:**

| Option | Description |
|--------|-------------|
| `--product <slug>` | Scope search to a product |
| `--feature <slug>` | Scope search to a feature |

---

### `lock revert <id>` — Revert a Decision

Mark a decision as reverted.

```bash
lock revert l-a7f3e2 "Requirements changed"
lock revert l-a7f3e2 -m "Requirements changed"
```

The reason can be provided as a positional argument or with the `-m` flag.

---

### `lock link <id> <ref>` — Add External Link

Attach a reference to a decision.

```bash
lock link l-a7f3e2 TRADE-442
lock link l-a7f3e2 https://github.com/org/repo/pull/123
```

Link type is auto-detected from the reference format (Jira, GitHub, Figma, Linear, Notion, or other).

---

### `lock products` — List Products

```bash
lock products
```

Shows all products with lock counts and descriptions.

---

### `lock features` — List Features

```bash
lock features
lock features --product trading
```

---

### `lock export` — Export to Markdown

Export active decisions to a Markdown file, useful for documentation or sharing.

```bash
lock export
lock export --product trading
lock export --output DECISIONS.md
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--product <slug>` | Filter by product | config default |
| `--feature <slug>` | Filter by feature | — |
| `--scope <scope>` | Filter by scope | — |
| `--output <path>` | Output file path | `LOCK.md` |

The exported file groups decisions by feature and sorts by scope (architectural first).

---

## Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `~/.lock/credentials` | Home directory | API URL and key (created on first use) |
| `.lock/config.json` | Project directory | Product and feature scope (created by `lock init`) |

Both are JSON files. The credentials file has restricted permissions for security.
