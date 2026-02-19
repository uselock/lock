# Lock Website Brief — Main Page & Features Page

This document is a comprehensive brief for the agent building the Lock website. It explains exactly what Lock does, who it's for, and what messaging should appear on the main page and features page. Use this as the source of truth — every claim here is accurate to the actual product.

---

## THE ONE-LINER

**Lock is git commit for product decisions.**

Teams make decisions in Slack threads that get implemented but never formally recorded. Three months later, nobody knows why something was built a certain way. Lock captures decisions where they happen — in Slack, in the terminal, or inside AI agent sessions — with full context, conflict detection, and a permanent audit trail.

---

## MAIN PAGE

### Hero Section

**Headline:** "Your team's decisions disappear. Lock makes them permanent."

**Subheadline:** Lock captures product decisions where they happen — Slack threads, terminal sessions, AI agents — so your team always knows what was decided, why, and by whom.

**Supporting context for the hero:** The core pain is that product teams make dozens of decisions per week in Slack threads, meetings, and code reviews. These decisions drive implementation but are never recorded anywhere. When someone new joins, when a decision is questioned 3 months later, when an AI agent builds a feature without knowing constraints — nobody can find the original decision. Lock solves this with a single action: `@lock` a decision and it's captured forever with full context.

**Primary CTA:** "Get Started" (links to docs/setup)
**Secondary CTA:** "See how it works" (scrolls to demo/walkthrough)

---

### Problem Section

**Heading:** "Decisions drive your product. But where do they live?"

This section should make the reader feel the pain. Here are the real scenarios:

1. **The Slack graveyard** — "We decided to use notional value instead of margin" lives in a Slack thread from February. By June, nobody can find it. A new engineer builds the opposite.

2. **The onboarding gap** — A new team member asks "why is it built this way?" Nobody remembers. The original author left. The Slack thread was in a channel that got archived.

3. **The AI blind spot** — Your AI coding agent writes a caching layer using Memcached. Your team decided on Redis two weeks ago in a Slack thread. The agent didn't know.

4. **The invisible contradiction** — Team A decides "all prices should use end-of-day snapshots." Team B, working on a different feature of the same product, decides "use real-time prices for the dashboard." Nobody catches the conflict because they're in different channels.

**Key message:** Decisions aren't a documentation problem. They're an infrastructure problem. You need a system that captures them at the moment they're made, not a wiki page someone has to remember to update.

---

### How It Works Section

**Heading:** "One command. Full context. Permanent record."

Show the three-step flow:

**Step 1: Decide** — Your team agrees on something in a Slack thread, a terminal session, or while working with an AI agent.

**Step 2: Lock** — One command captures the decision with full context:
- In Slack: `@lock Use notional value instead of margin for position display`
- In terminal: `lock "Use notional value instead of margin"`
- AI agents record decisions automatically via MCP

**Step 3: It's locked** — The decision is:
- Permanently recorded with the author, timestamp, and surrounding discussion
- Automatically checked against all existing decisions for conflicts
- Linked to the product and feature it belongs to
- Visible across every surface — Slack, CLI, AI agents, API

**Visual concept:** Show the three surfaces (Slack message, terminal command, AI agent session) all flowing into a single decision record, with a Slack notification going out to the team.

---

### Three Surfaces Section

**Heading:** "Capture decisions wherever they happen"

Lock meets your team where they work. Not another tool to check — it's embedded in the tools you already use.

**Slack** — `@lock` in any thread. Lock captures the decision, the surrounding discussion, the participants, and a permalink back to the thread. Three modes:
- Type the decision explicitly: `@lock Use Redis for caching`
- Point at a thread and let AI extract it: `@lock this`
- Give a rough idea and let Lock polish it: `@lock the fact that we're using Redis`

**CLI** — `lock "message"` from any project directory. Scoped to the product and feature you're working on. Integrates with your dev workflow — check for existing decisions before building, commit new ones as you go.

**AI Agents** — MCP server gives Claude Code, Cursor, and other AI agents direct read/write access to your team's decisions. Agents check constraints before coding and record decisions as they work. Your team gets a Slack notification for every decision an agent makes.

**Key message:** Decisions made in any surface are immediately visible in all other surfaces. The CLI decision shows up in Slack. The agent's decision shows up in Slack. Slack is the awareness layer.

---

### Conflict Detection Section

**Heading:** "Catch contradictions before they become bugs"

When a new decision is locked, Lock automatically checks it against every active decision in the same product — across all features. This means a decision in "Margin Rework" is checked against decisions in "Position Display" and "Risk Engine."

**How it works:**
1. The decision is converted into a semantic vector (AI embedding)
2. PostgreSQL (pgvector) finds the most similar existing decisions
3. An LLM classifies each match: unrelated, related, conflicting, or superseding

**What you see:** When you lock a decision that conflicts with an existing one, Lock tells you immediately — right in the Slack thread or terminal output. You see the conflicting decision, an explanation of why they conflict, and can choose to proceed or reconsider.

**Supersession:** When Lock detects that a new decision replaces an older one, it automatically links them. The old decision is marked as superseded. This creates a lineage chain — you can trace how any decision evolved over time.

**Example conflict detection output:**
```
Lock committed: l-a7f3e2
"Use notional value instead of margin for position display"

  Warning: Potential conflict detected
  l-b8c4f1: "Display all values in margin terms"
  "These decisions contradict each other on what metric to display."

  Supersedes: l-x9y2z3: "Use margin for position display"
  "The new decision directly replaces the approach in l-x9y2z3."
```

---

### Decision Lineage Section

**Heading:** "See how any decision evolved"

Decisions aren't static. They evolve. Lock tracks the full history:

```
"Use margin for display" (l-x9y2z3) [superseded]
    ↓
"Use notional value instead" (l-a7f3e2) [superseded]
    ↓
"Use both, togglable by user" (l-d4e5f6) [active]
```

Every decision knows what it superseded and what superseded it. Reverts are tracked too. When someone asks "why did this change?", the entire chain is one command away.

---

### Who It's For Section

**Heading:** "Built for teams that ship fast and forget faster"

- **Product teams** — Record decisions during discovery, design, and planning. Never lose context.
- **Engineering teams** — Know what was decided before you build. Check constraints, don't repeat mistakes.
- **AI-augmented teams** — Give your AI agents the full decision context. They'll write better code.
- **Team leads** — Get a recap of all active decisions for a product at any time. Onboard new members with full context.
- **Anyone who's been burned** — by implementing something that contradicted a decision they didn't know about.

---

### Trust / Design Principles Section

**Heading:** "Opinionated by design"

These are the principles that make Lock reliable:

- **Immutable** — Decisions cannot be edited after creation. This is intentional. Decisions are historical records. You can revert or supersede, but never rewrite history.
- **Zero-friction** — `@lock this` in a Slack thread. That's it. No forms, no workflows, no approval queues (unless you want them).
- **Products and features auto-create** — No admin setup. First reference to "trading/margin-rework" creates both. Start using Lock in 30 seconds.
- **Slack is the awareness layer** — Even decisions from CLI or AI agents are surfaced in Slack. Your team always sees what's happening.
- **Cross-feature conflict detection** — Decisions are checked against the entire product, not just the feature they belong to. Contradictions between teams are caught.

---

### Social Proof / Use Case Section

Show a concrete scenario from start to finish:

**Scenario: The margin rework**

1. Team discusses margin vs. notional value in a Slack thread over 2 days
2. They agree: `@lock Use notional value instead of margin for position display --scope major --ticket TRADE-442`
3. Lock captures the decision, the full thread context, links it to TRADE-442
4. Two weeks later, an engineer on a different feature runs `lock check "refactor position display"` and sees the constraint
5. An AI agent working on the dashboard queries Lock and respects the decision
6. A month later, requirements change. The team runs `@lock revert l-a7f3e2 "Client wants margin view back"` — the revert is recorded, the context preserved

**Key message:** Every step happens where the team already works. No context switching. No wikis to update. The decision trail is automatic.

---

## FEATURES PAGE

### Page Heading

**"Everything Lock does"**

Subheading: "One protocol. Three surfaces. Every decision captured."

---

### Feature 1: Slack Bot

**Heading:** "@lock — Record decisions in your Slack threads"

Lock lives in Slack because that's where your team makes decisions. The bot listens for `@lock` mentions and supports three modes of capturing a decision:

**Explicit mode** — You write the decision yourself:
```
@lock Use notional value instead of margin for position display
@lock Use Redis for caching --scope major --ticket TRADE-442 --tag infra
```

**Extract mode** — Point at a conversation and let Lock figure it out:
```
@lock this
@lock that
@lock        (bare mention in a thread)
```
Lock reads the last 5 messages, uses an LLM to extract the decision, and shows you a preview with confidence score. You confirm, edit, or cancel before anything is committed.

**Polish mode** — Give a rough idea, Lock cleans it up:
```
@lock the fact that we're switching to Redis
@lock the decision that all APIs need pagination
```
Lock takes your hint, reads the thread context, and produces a clean decision statement. Auto-commits.

**Thread context capture:** When used inside a thread, Lock automatically captures the last 5 messages, all participant names, and a permalink back to the thread. This context is stored permanently with the decision.

**Post-commit enrichment:** After a decision is committed, interactive buttons let you change scope, add a Jira ticket, add a Figma link, or add tags — without running another command.

**Other Slack commands:**
- `@lock init --product p --feature f` — Map a channel to a product/feature
- `@lock log` — Browse recent decisions with filters
- `@lock recap --product trading` — Get a grouped summary of all active decisions
- `@lock search "query"` — Semantic search across all decisions
- `@lock revert l-abc123 "reason"` — Revert a decision
- `@lock link l-abc123 TRADE-442` — Attach a Jira/GitHub/Figma reference
- `@lock products` / `@lock features` — List products and features
- `@lock describe --product p "description"` — Update product/feature descriptions

---

### Feature 2: CLI

**Heading:** "lock — Decisions from your terminal"

The CLI integrates decision tracking into the developer workflow. Initialize a project directory, commit decisions, check for constraints, and browse the decision log — all from the terminal.

**Project scoping:**
```bash
lock init --product trading --feature margin-rework
```
Creates a `.lock/config.json` that scopes all commands to that product/feature. Interactive mode (run `lock init` with no flags) lets you pick from existing products and features.

**Commit a decision:**
```bash
lock "Use Redis for session caching"
lock "Migrate to PostgreSQL 16" --scope architectural --tag infrastructure
```

**Check before you build:**
```bash
lock check "refactor position display to show PnL"
```
Searches for existing decisions relevant to your intent. Surfaces constraints you might not know about. Run this before starting any task.

**Browse and search:**
```bash
lock log --product trading --scope major
lock show l-a7f3e2
lock search "how do we handle caching"
```

**Export to markdown:**
```bash
lock export --product trading --output DECISIONS.md
```
Generates a clean markdown file of all active decisions, grouped by feature, sorted by scope.

**Key detail:** The CLI is a thin client — all logic lives in the core API. It calls `POST /api/v1/locks` just like the Slack bot. Decisions from CLI are notified to the relevant Slack channel automatically.

---

### Feature 3: MCP Server (AI Agents)

**Heading:** "Give your AI agents decision context"

The Lock MCP server gives AI coding agents (Claude Code, Cursor, Windsurf, etc.) direct access to your team's product decisions. This is the missing link between team decisions and AI-generated code.

**The problem it solves:** Without Lock, AI agents code in a vacuum. They don't know your team decided "use notional value instead of margin" or "all public APIs must use pagination." They'll build something that contradicts your decisions and you won't catch it until code review.

**What agents can do:**
- **Read decisions** — Query, search, and browse the full decision log before writing code
- **Check constraints** — Semantic search to find decisions relevant to the task at hand
- **Record decisions** — Commit new decisions as they make implementation choices
- **Trace lineage** — See how any decision evolved over time

**Setup is one JSON block** in your MCP config:
```json
{
  "mcpServers": {
    "lock": {
      "command": "npx",
      "args": ["@uselock/mcp-server"],
      "env": {
        "LOCK_API_URL": "https://your-instance.com",
        "LOCK_API_KEY": "lk_..."
      }
    }
  }
}
```

**Available tools:**
| Tool | Description |
|------|-------------|
| `lock_query` | Query decisions with filters (product, feature, scope, status, tags) |
| `lock_search_semantic` | Natural language search across all decisions |
| `lock_get` | Get full details of a single decision |
| `lock_get_lineage` | Trace the evolution of a decision |
| `lock_list_products` | List products with decision counts |
| `lock_list_features` | List features for a product |
| `lock_commit` | Record a new decision (with automatic conflict detection) |

**Cross-surface visibility:** Every decision an agent commits is posted to the relevant Slack channel. Your team always knows what the agent decided.

---

### Feature 4: Conflict Detection

**Heading:** "Automatic contradiction detection across your entire product"

Every new decision is checked against all active decisions in the same product — across all features. Not just keyword matching. Semantic understanding.

**Pipeline:**
1. Decision text → vector embedding (OpenAI text-embedding-3-small)
2. Similarity search across all active decisions in the same product (pgvector)
3. LLM classification of each match: unrelated, related, conflicting, or superseding (Claude)

**Cross-feature detection:** A decision in "Margin Rework" is checked against decisions in "Position Display," "Risk Engine," and every other feature in the product. Contradictions between teams working on different features are caught automatically.

**What gets surfaced:**
- **Potential conflicts** — "Decision A says X, Decision B says the opposite" with an explanation
- **Supersessions** — "This new decision replaces an older one" — old decision is automatically marked superseded

**Performance:** Under 3 seconds total. Embedding (~100ms) + vector search (~50ms) + LLM classification (~1-2s per candidate).

---

### Feature 5: Decision Lineage

**Heading:** "Trace how any decision evolved"

Decisions aren't static. They get refined, reversed, and replaced. Lock tracks the full chain.

**Supersession chain:**
```
v1: "Use margin for display" [superseded]
  → v2: "Use notional value" [superseded]
    → v3: "Use both, togglable" [active]
```

**Reverts:**
```
"Cache everything in Redis" [reverted]
  → "Reverted: Redis OOM issues in prod" [active]
```

Every decision knows its parent and its children. The lineage command shows the complete tree. This is how you answer "why did this change?" in 5 seconds instead of 30 minutes of Slack archaeology.

---

### Feature 6: Organization (Products, Features, Scopes)

**Heading:** "Structured without being bureaucratic"

**Products** — Top-level unit. Maps to whatever your team considers a product: "Trading Platform," "Risk Engine," "Mobile App." Identified by a URL-safe slug.

**Features** — Scoped area within a product. Maps to workstreams, epics, or functional areas: "Margin Rework," "Position Display," "User Onboarding." Also slug-based.

**Auto-creation:** Products and features are created on first reference. No admin step. Run `@lock init --product trading --feature margin-rework` and both are created if they don't exist. Zero setup friction.

**Scopes:**
| Scope | When to use |
|-------|-------------|
| `minor` | Day-to-day implementation choices |
| `major` | Significant product or technical decisions |
| `architectural` | Foundational decisions that affect the system |

Scope affects visibility in recaps and how aggressively conflict detection surfaces a decision.

---

### Feature 7: External Links

**Heading:** "Connect decisions to everything else"

Attach Jira tickets, GitHub PRs, Figma files, Linear issues, and Notion pages to any decision.

```
@lock link l-a7f3e2 TRADE-442
@lock link l-a7f3e2 https://github.com/org/repo/pull/123
```

Link type is auto-detected from the reference format. Add links at commit time with `--ticket` or after the fact with `@lock link`.

Supported link types: Jira, GitHub, Figma, Linear, Notion, and custom URLs.

---

### Feature 8: Cross-Surface Notifications

**Heading:** "Every decision shows up in Slack"

Slack is the awareness layer. When a decision is recorded from CLI or an AI agent, Lock posts a notification to the relevant Slack channel:

```
New lock from cli (l-a7f3e2)
  "Cache user sessions in Redis"
  Author: philippe via cli
```

This ensures the entire team sees every decision regardless of where it originated. No decision slips through silently.

---

### Feature 9: Semantic Search

**Heading:** "Find decisions by meaning, not keywords"

`lock search "how do we handle caching"` finds decisions about Redis, Memcached, CDN, and cache invalidation — even if none of them use the word "caching."

Powered by vector embeddings and pgvector. Available in all three surfaces: Slack (`@lock search`), CLI (`lock search`), and MCP (`lock_search_semantic`).

---

### Feature 10: Recap

**Heading:** "Get the full picture in one command"

`@lock recap --product trading` returns every active decision for a product, grouped by feature, sorted by scope (architectural first).

Use it to:
- Onboard a new team member ("here's everything we've decided for the trading platform")
- Start a planning session with full context
- Audit what's been decided across all features

---

## TECHNICAL DETAILS (for a "How it's built" or footer section)

- **Stack:** Node.js, Fastify, PostgreSQL with pgvector, Drizzle ORM
- **AI:** OpenAI embeddings for semantic search, Claude for conflict classification and thread extraction
- **Slack:** Bolt SDK with socket mode
- **MCP:** Model Context Protocol SDK for AI agent integration
- **Architecture:** Monorepo with pnpm workspaces. Core API + thin surface clients (Slack, CLI, MCP). All business logic in the core.
- **Self-hostable:** Docker Compose for PostgreSQL. Bring your own OpenAI and Anthropic API keys.
- **Open source:** MIT license

---

## MESSAGING GUIDELINES

**Do say:**
- "git commit for decisions" — this is the core metaphor, everyone gets it immediately
- "where decisions happen" — Lock goes to the team, the team doesn't go to Lock
- "Slack thread" — specific, relatable, every product person knows the pain
- "three months later" — time-based pain that resonates
- "AI agents don't know" — new category of pain, differentiated

**Don't say:**
- "decision management platform" — too enterprise, too vague
- "knowledge base" — Lock is not a wiki
- "documentation tool" — Lock doesn't replace docs, it captures the atomic unit (the decision) that docs are built from
- "approval workflow" — Lock is low-friction by design, not a gate
- "governance" — sounds like compliance software

**Tone:** Direct, technical, zero fluff. Lock is built for teams that ship fast. The website should feel like a well-written README, not a marketing brochure. Show real commands, real output, real scenarios.
