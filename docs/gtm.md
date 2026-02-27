# Go-To-Market Strategy for Lock

> Internal strategy document. Not for public distribution.

---

## 1. Positioning & Messaging

### One-Liner

**Lock is git commit for product decisions.**

### Elevator Pitch

Teams make dozens of product decisions every week in Slack threads. Those decisions drive implementation but are never formally recorded. Three months later, nobody knows why something was built a certain way — and AI agents building features have zero context on what the team agreed. Lock captures decisions where they happen (Slack, terminal, AI agents) with full context, automatic conflict detection, and a permanent audit trail.

### Key Differentiators

| Differentiator | What it means |
|---|---|
| **Multi-surface capture** | Decisions are recorded in Slack, CLI, and AI agent sessions — not in a separate tool nobody opens |
| **AI-native** | MCP server gives coding agents (Claude Code, Cursor) read/write access to team decisions. Agents check constraints before coding. |
| **Conflict detection** | Every new decision is semantically checked against all active decisions in the same product, across features. Contradictions are caught automatically. |
| **Zero-friction** | `@lock this` in a Slack thread. No forms, no approval queues, no context switching. |
| **Immutable + traceable** | Decisions can't be edited — only superseded or reverted. Full lineage chain shows how any decision evolved. |
| **Self-hostable open source** | Docker Compose, MIT license, bring your own LLM keys. No vendor lock-in. |

### Core Metaphor

**"git commit for decisions"** — this is the primary framing. Everyone in the target audience understands git commit. It implies: atomic, immutable, traceable, part of a history, something you do as part of your workflow.

### Three Pain Points

1. **The Slack Graveyard** — "We decided to use notional value instead of margin" lives in a Slack thread from February. By June, nobody can find it. A new engineer builds the opposite.

2. **The AI Blind Spot** — Your AI coding agent writes a caching layer using Memcached. Your team decided on Redis two weeks ago in a Slack thread. The agent didn't know. This is a new category of pain that only gets worse as AI adoption increases.

3. **Invisible Contradictions** — Team A decides "all prices use end-of-day snapshots." Team B decides "use real-time prices for the dashboard." Nobody catches the conflict because they're in different channels, different features, different conversations.

### Messaging Do's and Don'ts

**Do say:** "git commit for decisions," "where decisions happen," "Slack thread," "three months later," "AI agents don't know"

**Don't say:** "decision management platform," "knowledge base," "documentation tool," "approval workflow," "governance"

**Tone:** Direct, technical, zero fluff. Show real commands, real output, real scenarios. Lock should feel like a well-written README, not a marketing brochure.

---

## 2. Target Audience

### Primary: Product Managers

PMs feel the pain most acutely. They make decisions all day in Slack and have no system of record. They're the ones who get asked "why was it built this way?" three months later and can't find the answer.

**Pain points that resonate:**
- Decisions buried in Slack threads nobody can find later
- Onboarding new team members without decision context
- No way to get a recap of all active decisions for a product
- Cross-team contradictions caught too late (in code review or production)

**Entry point:** Slack bot. PMs live in Slack. `@lock` is zero-friction.

### Secondary: AI-Augmented Dev Teams

Teams using Claude Code, Cursor, or other AI coding agents. These teams are experiencing the AI blind spot for the first time — agents building features without knowing team constraints.

**Pain points that resonate:**
- AI agents contradict team decisions because they have no context
- No way to feed product decisions into AI coding workflows
- Agent-made decisions aren't visible to the rest of the team

**Entry point:** MCP server. One JSON block in their config and their agents have full decision context.

### Tertiary: Engineering Leads

Tech leads and engineering managers who care about architectural decision records (ADRs) but find them too heavyweight. They want decision tracking that's lightweight enough that people actually use it.

**Pain points that resonate:**
- ADRs are too heavyweight — nobody writes them
- Architectural decisions aren't tracked alongside product decisions
- No way to check if a proposed change contradicts existing constraints

**Entry point:** CLI. `lock check "refactor position display"` before starting work.

### Ideal Customer Profile (ICP)

| Attribute | Description |
|---|---|
| **Team size** | 5-50 people (small enough to adopt without procurement, large enough to have the pain) |
| **Stack** | Modern — using Slack, GitHub, probably experimenting with AI coding tools |
| **Industry** | Product-led SaaS, fintech, developer tools, any team shipping fast |
| **Decision velocity** | High — multiple product and technical decisions per week |
| **Pain signal** | Has experienced "why was it built this way?" with no answer, or AI agent contradicting team decisions |
| **Champion** | PM or tech lead frustrated with decision amnesia, technically capable enough to self-host |

---

## 3. Launch Plan

### Pre-Launch (T-7 to T-1)

**Goal:** Build anticipation and warm up channels.

- [ ] Final audit of README, docs, and CONTRIBUTING.md
- [ ] Record a 2-minute demo video showing the Slack → CLI → MCP flow
- [ ] Create demo GIF (Slack `@lock this` → conflict detection → notification)
- [ ] Prep all draft content (HN, PH, Twitter, Reddit — see Section 9)
- [ ] Set up @uselockai Twitter/X account with bio, pinned tweet placeholder
- [ ] Identify 20-30 people to DM on launch day (PMs, AI dev advocates, OSS maintainers)
- [ ] Submit Product Hunt listing for scheduling
- [ ] Soft-share with 3-5 trusted PMs/devs for early feedback and launch-day support

### Launch Day (T+0)

**Goal:** Maximum coordinated visibility across all channels within a 2-hour window.

**Sequence:**
1. **Product Hunt** goes live (scheduled the night before, or hunter triggers it)
2. **Hacker News** Show HN post — submit within 30 min of PH going live
3. **Twitter/X** launch thread from @uselockai — post immediately after HN
4. **Reddit** posts to r/productmanagement and r/programming — stagger by 1 hour
5. **DMs** to warm contacts — "we just launched, would love your take"
6. **Monitor and respond** — be in every comment thread for the first 12 hours

### Launch Week (T+1 to T+7)

**Goal:** Sustain momentum, respond to feedback, ship quick fixes.

- Respond to every HN comment, PH comment, Reddit comment, and GitHub issue within 4 hours
- Publish a "Building Lock" blog post on personal blog / dev.to — the story behind why it was built
- Share any early user stories or testimonials on Twitter
- Ship at least one community-requested fix or improvement (shows responsiveness)
- Cross-post to relevant Slack/Discord communities (see Channel Strategy)
- Track all feedback in a GitHub Discussion or issue — public roadmap signal

---

## 4. Channel Strategy

### Product Hunt

**Why:** PM audience lives here. This is the primary launch platform for reaching product managers.

**Timing:** Schedule for a Tuesday or Wednesday. Avoid Mondays (competitive) and Fridays (low traffic).

**Prep:**
- Recruit a well-known hunter if possible, otherwise self-hunt
- Prepare: tagline, description, first comment, 4-5 screenshots/GIFs, demo video
- Have 10+ people ready to upvote and leave genuine comments in the first 2 hours
- Respond to every comment personally

### Hacker News

**Why:** Technical credibility. Developer audience. HN loves open source tools with clear utility.

**Angle:** "Show HN" — technical, honest, self-hosted first. Lead with the `git commit` metaphor. Emphasize: open source, self-hostable, no SaaS lock-in, pgvector for conflict detection.

**Timing:** Post between 8-10am ET on a weekday. Avoid weekends (lower developer traffic).

**Key:** The first comment (by the poster) sets the tone. Be genuine, explain the pain, mention what's missing / what's next. HN rewards authenticity.

### Twitter/X (@uselockai)

**Why:** Real-time reach, shareable GIFs, good for threading a narrative.

**Approach:**
- Launch thread (5-7 tweets — see Section 9)
- Follow up with individual feature highlights (one tweet per feature, with GIF)
- Quote-tweet and respond to anyone who mentions Lock
- Tag people who write about decision-making, AI dev tools, or product ops

**Ongoing:** 2-3 tweets per week — feature highlights, user stories, "did you know" tips.

### Reddit

**Subreddits:**

| Subreddit | Angle | Notes |
|---|---|---|
| r/productmanagement | PM pain: Slack graveyard, decision amnesia | Lead with the problem, not the tool |
| r/programming | Technical: "git commit for decisions," pgvector, MCP | Show architecture, code, conflict pipeline |
| r/ExperiencedDevs | ADR replacement, architectural decision tracking | Speak to the "why was it built this way?" pain |
| r/SaaS | Building in public, open source launch story | Narrative angle |

**Rules:** Reddit hates self-promotion. Lead with value, tell a story, mention Lock naturally. Different post for each subreddit — tailored angle, not cross-posted.

### Dev Communities

| Community | Approach |
|---|---|
| AI dev Discords (Claude Code, Cursor communities) | Share the MCP integration. "Give your AI agents product decision context." |
| Product management Slack groups | Share the problem/solution narrative. Offer to demo. |
| DevOps / Platform engineering communities | Self-hosting angle, Docker Compose, pgvector. |
| Indie hackers / building in public | Launch story, metrics transparency, OSS approach. |

### Content Marketing (Weeks 2-8)

| Content | Platform | Angle |
|---|---|---|
| "Why We Built Lock" | Personal blog / dev.to | Origin story, the Slack thread that got lost |
| "git commit for decisions" | Hacker Noon / Medium | The concept piece — why decisions need version control |
| "How to Give AI Agents Product Context" | dev.to | MCP tutorial with Lock + Claude Code |
| "ADRs Are Too Heavyweight" | dev.to / blog | Why lightweight decision tracking beats formal ADRs |
| "Building Conflict Detection with pgvector" | dev.to | Technical deep-dive on the conflict pipeline |

---

## 5. Launch Assets Needed

| Asset | Status | Owner | Notes |
|---|---|---|---|
| README.md | Done | — | Covers quick start, all surfaces, all commands |
| CONTRIBUTING.md | Done | — | Development setup and guidelines |
| LICENSE (MIT) | Done | — | |
| SECURITY.md | Done | — | |
| docs/ site | Done | — | Full reference docs for all surfaces |
| Website brief | Done | — | `docs/website-brief.md` — messaging, features, hero content |
| Demo GIF | **Needed** | — | 30-second GIF: `@lock this` in Slack → conflict detected → team notified |
| Demo video | **Needed** | — | 2-minute walkthrough: Slack → CLI → MCP → conflict detection |
| HN Show post | **Draft below** | — | Section 9 |
| Product Hunt listing | **Draft below** | — | Section 9 |
| Twitter launch thread | **Draft below** | — | Section 9 |
| Reddit posts | **Drafts below** | — | Section 9 |
| Landing page | **Needed** | — | Use `docs/website-brief.md` as the content brief |
| OG image / social card | **Needed** | — | For link previews on Twitter, HN, Reddit |

---

## 6. Growth Loops

### Loop 1: Open Source → Stars → Visibility

```
Developer finds Lock → stars repo → appears in GitHub trending
→ more developers find Lock → more stars → sustained visibility
```

**Fuel:** Quality README, clear value prop, easy Docker setup. Bonus: "Sponsor" button for early supporters.

### Loop 2: MCP Integration → AI Dev Community

```
Dev adds Lock MCP to Claude Code/Cursor → agents check decisions before coding
→ dev shares the setup in AI community → more devs try it → more MCP installs
```

**Fuel:** The MCP setup is one JSON block. The value is immediate — agents stop contradicting team decisions. AI dev communities are tight-knit and share tools aggressively.

### Loop 3: Slack Bot → Team Viral Spread

```
One PM installs the Slack bot → team sees @lock messages → team adopts
→ other teams in the org see it → cross-org adoption
```

**Fuel:** Slack is inherently viral within organizations. Every `@lock` message is a micro-advertisement. Cross-surface notifications ensure every decision is visible.

### Loop 4: `lock export` → LOCK.md → Organic Discovery

```
Team exports decisions to LOCK.md → commits it to their repo
→ other devs see LOCK.md → google "what is LOCK.md" → find Lock
```

**Fuel:** Similar to how `LICENSE`, `CONTRIBUTING.md`, and `CHANGELOG.md` became standard repo files. If `LOCK.md` appears in enough repos, it becomes a discovery channel.

### Loop 5: Conflict Detection → "Wow" Moment → Sharing

```
User commits a decision → Lock catches a contradiction they didn't know about
→ user shares the moment ("Lock just saved us from a contradicting decision")
→ organic social proof → new users
```

**Fuel:** Conflict detection is the "magic" feature. When it catches a real contradiction, it's a shareable moment. Encourage users to screenshot and share.

---

## 7. Success Metrics

### Week 1 (Launch Wave)

| Metric | Target | Why it matters |
|---|---|---|
| GitHub stars | 200+ | Social proof, trending potential |
| HN upvotes | 50+ (front page) | Drives first wave of traffic |
| Product Hunt upvotes | Top 10 of the day | PM audience discovery |
| Unique clones/visitors | 500+ | Interest signal |
| GitHub issues opened | 10+ | Community engagement signal |
| First external PR | 1+ | Contributor interest |

### Month 1 (Early Adoption)

| Metric | Target | Why it matters |
|---|---|---|
| GitHub stars | 500+ | Sustained interest |
| Self-hosted installations | 20+ | Real usage (track via opt-in telemetry or Docker Hub pulls) |
| Slack bot installs | 5+ teams | Multi-surface adoption |
| GitHub issues + PRs | 30+ | Active community forming |
| Twitter followers (@uselockai) | 200+ | Audience building |
| "How do I host this?" questions | 5+ | Demand signal for hosted offering |
| Repeat users (>5 locks) | 10+ teams | Retention / stickiness |

### Month 3 (Product-Market Fit Signals)

| Metric | Target | Why it matters |
|---|---|---|
| GitHub stars | 1,500+ | Established project |
| Weekly active teams | 30+ | Real, sustained usage |
| Community contributors | 5+ | Healthy open source project |
| "Can you host this for me?" requests | 10+ | Direct signal for paid offering |
| LOCK.md in external repos | 10+ | Organic adoption loop working |
| MCP integration mentions | Regular | AI dev community traction |
| Inbound from companies | 3+ | Enterprise interest signal |

---

## 8. 90-Day Timeline

### Weeks 1-2: Launch + Initial Wave

| Day | Action |
|---|---|
| T-7 | Final repo audit, prep all content, record demo video/GIF |
| T-3 | Soft-share with trusted contacts for early feedback |
| T-1 | Schedule Product Hunt, prep all posts |
| **T+0** | **Launch: PH + HN + Twitter + Reddit** |
| T+1 to T+3 | Respond to all feedback, ship quick fixes, engage in every thread |
| T+4 to T+7 | Publish "Why We Built Lock" blog post, share early wins |
| T+7 to T+14 | Sustain engagement, address top GitHub issues, community outreach |

### Weeks 3-4: Content Marketing + Tutorials

| Action | Details |
|---|---|
| Publish MCP tutorial | "How to Give AI Agents Product Decision Context" — step-by-step with Claude Code |
| Publish technical deep-dive | "Building Conflict Detection with pgvector" — technical audience on dev.to |
| Community engagement | Join 3-5 relevant Discord/Slack communities, contribute genuinely |
| Feature highlight tweets | One per day for a week — Slack extract mode, conflict detection, lineage, MCP, etc. |
| Address top 5 issues | Ship improvements based on launch feedback |

### Weeks 5-8: Community Building + Iteration

| Action | Details |
|---|---|
| Ship most-requested features | Based on GitHub issues and community feedback |
| Start GitHub Discussions | Create categories: Feature Requests, Show & Tell, Q&A |
| "Building in public" updates | Weekly Twitter thread on what shipped, what's next |
| Publish ADR comparison piece | "ADRs Are Too Heavyweight — Try This Instead" |
| Evaluate contributor PRs | Review, merge, and celebrate community contributions |
| Explore integration partnerships | Reach out to Linear, Notion, or other tools for integration interest |

### Weeks 9-12: Evaluate PMF + Plan Hosted Offering

| Action | Details |
|---|---|
| PMF assessment | Analyze: retention, repeat usage, "can you host this?" volume, inbound interest |
| User interviews | Talk to 5-10 most active users. What's working? What's missing? Would they pay? |
| Hosted offering decision | If PMF signals are positive: scope the hosted version (multi-tenant, auth, billing) |
| Pricing research | Survey users on willingness to pay, expected pricing model |
| Technical scoping | Plan multi-tenant architecture, managed PostgreSQL, onboarding flow |
| Announce roadmap | Public blog post: what's next for Lock, hosted offering timeline |

---

## 9. Draft Content

### 9a. Product Hunt Listing

**Tagline (60 chars max):**
> git commit for product decisions — Slack, CLI, AI agents

**Description:**

Lock captures product decisions where they happen — Slack threads, terminal sessions, AI agent sessions — so your team always knows what was decided, why, and by whom.

The problem: your team makes dozens of decisions per week in Slack. "Use notional value instead of margin." "Switch caching to Redis." "All public APIs need pagination." These decisions get implemented but never recorded. Three months later, nobody knows why something was built a certain way. Worse — your AI coding agents don't know either.

Lock solves this with one command:

- **Slack:** `@lock Use Redis for session caching` — captures the decision, the thread context, the participants
- **CLI:** `lock "Use Redis for session caching"` — from your terminal, scoped to your project
- **AI Agents:** MCP server gives Claude Code and Cursor read/write access to your team's decisions

Every decision is automatically checked against existing decisions for conflicts and contradictions. If Team A decided "use end-of-day prices" and Team B is about to decide "use real-time prices," Lock catches it.

Open source, self-hostable, MIT licensed. Docker Compose up and running in 2 minutes.

**First Comment (maker comment):**

Hey Product Hunt! I'm the maker of Lock.

I built this because I kept losing product decisions in Slack threads. The pattern was always the same:

1. Team discusses something in a Slack thread
2. We agree on an approach
3. Someone implements it
4. Three months later: "Why was it built this way?" and nobody can find the original conversation

The tipping point was when we started using AI coding agents. They'd build features that contradicted decisions the team made weeks ago — because the agent had no way to know.

Lock is simple: `@lock` a decision in Slack, and it's permanently captured with the full thread context, auto-classified, checked for conflicts, and visible across every surface.

What makes it different from a wiki or ADR:
- **Zero friction** — it's where you already work (Slack, terminal, AI agents)
- **Conflict detection** — new decisions are semantically checked against existing ones
- **AI-native** — MCP server gives your coding agents full decision context
- **Immutable** — decisions can't be edited, only superseded or reverted, like git commits

It's fully open source (MIT), self-hostable via Docker Compose, and works with both OpenAI and Anthropic.

Would love your feedback. What's missing? What would make you try this with your team?

---

### 9b. Hacker News — Show HN Post

**Title:**
> Show HN: Lock – Git commit for product decisions (Slack, CLI, MCP for AI agents)

**Text:**

Lock captures product decisions where they happen and checks them for conflicts — think `git commit` but for the decisions your team makes in Slack threads.

The problem I kept hitting: teams agree on things in Slack ("use notional value instead of margin," "switch to Redis for caching") and those decisions drive implementation, but they're never formally recorded. Three months later, nobody knows why something was built a certain way. And now with AI coding agents, the problem is worse — agents build features with zero context on what the team decided.

Lock works across three surfaces:

**Slack:** `@lock Use Redis for caching` captures the decision with the full thread context. Or just `@lock this` in a thread and the LLM extracts the decision from the conversation.

**CLI:** `lock "Use Redis for caching"` from the terminal. `lock check "refactor caching layer"` before you start work — surfaces any relevant constraints.

**MCP Server:** One JSON block in your Claude Code or Cursor config. Your AI agents can query existing decisions, check constraints before coding, and record new decisions. The team gets a Slack notification for every agent decision.

Under the hood: Fastify + PostgreSQL + pgvector. Every new decision is embedded (text-embedding-3-small), compared against all active decisions in the same product via cosine similarity, and an LLM classifies any matches as related, conflicting, or superseding. Supersession is automatic — old decisions are marked superseded with bidirectional links.

Supports both Anthropic (Claude) and OpenAI for LLM operations. Without any LLM key, the core works fine — just no conflict detection or extraction.

Self-hostable via Docker Compose. MIT licensed. No SaaS, no telemetry, no accounts.

GitHub: https://github.com/uselock/lock

Curious what HN thinks. The main open question for me is whether the MCP angle (giving AI agents decision context) is the primary value or if the Slack workflow alone is compelling enough.

---

### 9c. Twitter/X @uselockai Launch Thread

**Tweet 1 (hook):**
> We just open-sourced Lock — git commit for product decisions.
>
> Your team makes decisions in Slack threads that get implemented but never recorded. Three months later, nobody knows why something was built that way.
>
> Lock fixes this. Here's how it works:

**Tweet 2 (Slack surface):**
> In Slack: `@lock Use notional value instead of margin`
>
> Lock captures the decision, the thread context, the participants, and checks it against every existing decision for conflicts.
>
> Or just say `@lock this` and the LLM extracts the decision from the thread.
>
> [GIF of Slack flow]

**Tweet 3 (conflict detection):**
> The killer feature: automatic conflict detection.
>
> Team A locks "use end-of-day price snapshots." Team B is about to lock "use real-time prices."
>
> Lock catches it instantly — across features, across channels.
>
> [Screenshot of conflict detection output]

**Tweet 4 (AI agents):**
> The reason I built this: AI coding agents have zero context on team decisions.
>
> Lock's MCP server gives Claude Code and Cursor direct access to your decision log. Agents check constraints before coding. Every agent decision gets posted to Slack.
>
> One JSON block to set up.

**Tweet 5 (CLI):**
> From the terminal:
>
> `lock "Switch to Redis for caching" --scope major`
> `lock check "refactor the caching layer"` — shows relevant constraints
> `lock export` — generates a LOCK.md with all active decisions
>
> The CLI is a thin client. All logic lives in the core API.

**Tweet 6 (tech stack):**
> Stack: Fastify + PostgreSQL + pgvector + Drizzle ORM
>
> Conflict detection pipeline: embed → vector similarity search → LLM classification
>
> Works with both Anthropic and OpenAI. Degrades gracefully without LLM keys.
>
> Self-hostable. Docker Compose. MIT licensed.

**Tweet 7 (CTA):**
> Lock is free, open source, and self-hostable.
>
> GitHub: github.com/uselock/lock
>
> If your team makes decisions in Slack that get lost — or if your AI agents keep contradicting team decisions — give it a try.
>
> Stars, issues, and feedback welcome.

---

### 9d. Reddit Post — r/productmanagement

**Title:** I built an open-source tool that captures product decisions from Slack threads so they stop getting lost

**Body:**

I've been a PM for years and the same problem kept coming up: we'd make a decision in a Slack thread — "use notional value instead of margin for position display" — and it would get implemented. But three months later, when someone asks "why is it built this way?", nobody can find the original thread. The author left. The channel got archived. The decision is just... gone.

I tried wikis, Notion pages, ADRs. Nobody maintained them. The problem isn't documentation — it's that the documentation step is always separate from where the decision was made.

So I built **Lock** — it's like `git commit` but for product decisions. You record a decision right where you made it:

- In Slack: `@lock Use notional value instead of margin for position display`
- Or point at a conversation: `@lock this` and the AI extracts the decision from the thread
- The decision is permanently recorded with the thread context, participants, and a link back

What makes it actually useful day-to-day:

1. **Conflict detection** — When you lock a new decision, it's automatically checked against all existing decisions in the same product. If Team A decided "use end-of-day snapshots" and Team B is about to decide "use real-time prices," Lock catches it before it becomes a bug.

2. **Recap** — `@lock recap --product trading` gives you every active decision for a product, grouped by feature. Instant context for onboarding or planning sessions.

3. **Search** — `@lock search "how do we handle caching"` — semantic search that finds relevant decisions even if they use different words.

4. **AI agent integration** — If your team uses AI coding tools (Claude Code, Cursor), Lock gives the agents direct access to your decision log. They check constraints before building. This alone has saved me from agents contradicting team decisions.

It's open source (MIT), self-hostable with Docker Compose, and works with Slack out of the box.

Curious if other PMs have this problem and how you've tried to solve it. Would love feedback on the approach.

GitHub: https://github.com/uselock/lock

---

### 9e. Reddit Post — r/programming

**Title:** Show r/programming: Lock — semantic conflict detection for product decisions using pgvector (open source)

**Body:**

I built an open-source tool called Lock that tracks product decisions across multiple surfaces (Slack, CLI, MCP for AI agents) and automatically detects conflicts between them using vector similarity search.

**The problem:** product teams make decisions in Slack threads that drive implementation but are never formally recorded. More importantly, decisions made by different teams on the same product can contradict each other without anyone noticing until it hits code review — or production.

**How conflict detection works:**

1. Every decision is embedded using text-embedding-3-small (1536-dim vector)
2. On commit, pgvector searches for the top 5 most similar active decisions in the same product (cosine distance, threshold > 0.75)
3. An LLM classifies each match as: `no_relation`, `related`, `potential_conflict`, or `supersession`
4. Supersession is applied automatically — old decision is marked superseded with bidirectional linking

The whole pipeline runs in under 3 seconds. Embedding ~100ms, vector search ~50ms, LLM classification ~1-2s per candidate.

**Architecture:**

```
Slack bot / CLI / MCP server (thin clients)
         ↓
   Fastify core API (all business logic)
         ↓
   PostgreSQL 16 + pgvector
```

Monorepo with pnpm workspaces. Drizzle ORM for everything except pgvector operations (raw SQL for those). ESM throughout. Both Anthropic and OpenAI supported for LLM operations — degrades gracefully without either.

**MCP server** is the part I'm most interested in feedback on. It exposes Lock as tools for AI coding agents (Claude Code, Cursor). Agents can query existing decisions, check constraints before building, and record new decisions. Every agent decision gets posted to Slack so the team is aware.

The `lock check "refactor position display"` command (CLI) and `lock_check` tool (MCP) do a semantic search for relevant constraints before you start work. Useful for catching "we already decided this" before you build the wrong thing.

Self-hostable via Docker Compose. MIT licensed. No telemetry, no accounts.

GitHub: https://github.com/uselock/lock

Interested in feedback on the architecture and the pgvector conflict detection approach specifically. Known limitation: embeddings are expensive to regenerate if you change models, and the 0.75 similarity threshold was tuned empirically — would love to hear from anyone who's worked with pgvector on similar classification problems.
