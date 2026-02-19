# Slack Bot

The Lock Slack bot lets your team record, search, and review product decisions directly in Slack. All commands start with `@lock`.

## Setup

### Install the App

1. Add the Lock app to your Slack workspace
2. Invite `@lock` to the channels where your team discusses product decisions

### Initialize a Channel

Before you can record decisions in a channel, map it to a product and feature:

```
@lock init --product trading --feature margin-rework
```

This tells Lock that all decisions in this channel belong to the `trading` product and `margin-rework` feature. Products and features are auto-created if they don't exist yet.

---

## Recording Decisions

Lock supports three ways to record a decision in Slack, depending on how much you want to type.

### Explicit: `@lock <message>`

Write the decision yourself. This is the most direct way.

```
@lock Use notional value instead of margin for position display
```

**With flags:**

```
@lock Use notional value instead of margin --scope major --ticket TRADE-442 --tag display --tag margin
```

**Flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--scope <minor\|major\|architectural>` | Decision impact level | `minor` |
| `--ticket <ID>` | Jira ticket reference (auto-creates a link) | — |
| `--tag <tag>` | Add a tag (can repeat for multiple tags) | — |

The decision is committed immediately. The response includes the lock, any detected conflicts, and supersession info.

### Extract: `@lock this` (in a thread)

Let Lock read the thread and extract the decision for you. Use this when a decision emerges from a conversation and you don't want to rephrase it.

```
@lock this
@lock that
@lock it
@lock              # bare mention in a thread also triggers extraction
```

Lock uses an LLM to read the thread context and extract:
- The **decision statement** — a clear, standalone summary
- The **scope** — inferred from the discussion
- **Tags** — auto-suggested from the content

You get an interactive preview before anything is committed:

```
Decision extracted — please confirm
> "Use notional value instead of margin for position display"
major | Confidence: 92% | Tags: display, margin
The team discussed margin vs notional and agreed on notional.

[Commit]  [Edit]  [Cancel]
```

- **Commit** — Record the decision as-is
- **Edit** — Opens a modal to refine the message, scope, tags, or add a Jira ticket before committing
- **Cancel** — Discard the extraction

Extraction only works inside a thread. If used in a top-level message, Lock will ask you to use it in a thread instead.

### Polish: `@lock the fact that...`

Write the gist and let Lock clean it up. The decision is auto-committed after polishing.

```
@lock the fact that we're using Redis for caching
@lock the decision that margin calculations should use end-of-day prices
```

Lock takes your hint, reads the surrounding thread context, and produces a polished decision statement. Unlike extract mode, polish auto-commits without a confirmation step — it trusts that you know what the decision is, and just helps you phrase it cleanly.

### Thread Context

For all three modes, when used inside a thread, Lock automatically captures:
- The last 5 messages from the thread as context
- All participants in the thread
- A permalink to the thread

This context is stored with the decision and is visible when viewing it later.

**Requirements:** The channel must be initialized with `@lock init` first.

---

## Post-Commit Actions

After a decision is committed, the response includes interactive buttons for enrichment:

| Button | Action |
|--------|--------|
| **Change scope** | Dropdown to switch between minor, major, and architectural |
| **Add Jira** | Opens a modal to attach a Jira ticket reference |
| **Add Figma** | Opens a modal to attach a Figma link |
| **Add tags** | Opens a modal to add comma-separated tags |

These let you enrich a decision after the fact without needing to use separate commands.

---

## Other Commands

---

### `@lock init` — Initialize Channel

Map a Slack channel to a product and feature.

```
@lock init --product trading --feature margin-rework
```

**Flags (both required):**

| Flag | Description |
|------|-------------|
| `--product <slug>` | Product slug (e.g., `trading`) |
| `--feature <slug>` | Feature slug (e.g., `margin-rework`) |

Products and features are auto-created if they don't exist. You only need to run this once per channel.

---

### `@lock log` — List Recent Decisions

Show recent locks with optional filtering.

```
@lock log
@lock log --product trading
@lock log --feature margin-rework
@lock log --scope major
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--product <slug>` | Filter by product |
| `--feature <slug>` | Filter by feature |
| `--scope <scope>` | Filter by scope |

Returns the 10 most recent locks matching your filters, with scope indicators, status badges, and metadata.

---

### `@lock recap` — Active Decision Summary

Get a grouped overview of all active decisions for a product.

```
@lock recap --product trading
@lock recap
```

If no `--product` flag is provided, Lock uses the channel's configured product.

**Flags:**

| Flag | Description |
|------|-------------|
| `--product <slug>` | Product to recap |
| `--feature <slug>` | Optionally filter to one feature |

**Output:** Decisions grouped by feature, sorted by scope (architectural first, then major, then minor). Includes a header with total counts.

This is useful for onboarding new team members or starting a planning session with full context of what's been decided.

---

### `@lock search "<query>"` — Semantic Search

Find decisions by meaning, not just keywords.

```
@lock search "margin calculation approach"
@lock search "display metrics" --product trading
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--product <slug>` | Scope search to a product |
| `--feature <slug>` | Scope search to a feature |

Uses vector embeddings to find semantically similar decisions, even if the exact words don't match.

---

### `@lock products` — List Products

Show all products with their decision counts.

```
@lock products
```

---

### `@lock features` — List Features

Show all features, optionally filtered by product.

```
@lock features
@lock features --product trading
```

---

### `@lock revert <id> "reason"` — Revert a Decision

Mark a decision as reverted and record the reason.

```
@lock revert l-a7f3e2 "Requirements changed — margin is needed after all"
```

This creates a new lock recording the revert and sets the original lock's status to `reverted`.

---

### `@lock link <id> <ref>` — Add External Link

Attach a Jira ticket, GitHub PR, Figma file, or other reference to a decision.

```
@lock link l-a7f3e2 TRADE-442
@lock link l-a7f3e2 https://github.com/org/repo/pull/123
```

Lock auto-detects the link type from the reference format:

| Pattern | Detected Type |
|---------|--------------|
| `PROJECT-123` | Jira |
| `github.com` URL | GitHub |
| `figma.com` URL | Figma |
| `linear.app` URL | Linear |
| `notion.so` URL | Notion |
| Anything else | Other |

---

### `@lock describe` — Update Descriptions

Add or update the description of a product or feature.

```
@lock describe --product trading "Core trading platform with risk controls"
@lock describe --feature margin-rework "Migrating margin calculation to notional value"
```

---

## Thread Context Capture

When you use `@lock` inside a Slack thread, Lock automatically enriches the decision with context from the discussion:

1. **Thread snippet** — The last 5 messages in the thread, with participant names
2. **Participants** — Everyone who contributed to the thread
3. **Permalink** — A link back to the original thread

This context is stored with the decision and is visible when viewing it later via `lock show` (CLI) or `lock_get` (MCP). This means the "why" behind a decision is always preserved alongside the "what."

## Notifications

When a decision is recorded from the CLI or MCP (not Slack), Lock posts a notification to the relevant Slack channel if one is configured:

```
New lock from cli (l-a7f3e2)
  "Cache user sessions in Redis"
  Author: philippe via cli
```

This ensures the team stays aware of all decisions, even those made outside Slack.
