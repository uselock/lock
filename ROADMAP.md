# Lock — Roadmap

Parked features for post-launch. Each section is self-contained and can be built independently.

---

## 1. Decision-Code Linking

Connect decisions made in Slack to code written in repos. The product slug is the shared key between surfaces.

### Interactive `lock init`

Current `lock init` takes raw text flags. Should fetch products/features from the API and let the developer pick from a list. `@inquirer/prompts` is already in CLI dependencies.

```
$ lock init

Select a product:
  1. trading (12 decisions)
  2. risk-engine (4 decisions)
> 1

Select a feature:
  1. margin-rework (8 decisions)
  2. Create new feature
> 1

✓ Initialized .lock/config.json — trading / margin-rework
```

**Files:** `packages/cli/src/commands/init.ts`

### `lock check` CLI command

Wraps the same logic as MCP `lock_check` for terminal and CI use. Developer types `lock check "refactor position display"` and sees relevant decisions before writing code.

**Files:** new `packages/cli/src/commands/check.ts`, register in `packages/cli/src/index.ts`

### Git hook: `lock hook install`

Writes a `prepare-commit-msg` hook that:

1. Reads `.lock/config.json` for product/feature scope
2. Queries active decisions for that scope
3. Appends `Decided-By: l-xxxxxx` trailers to the commit message
4. After commit, calls `POST /api/v1/locks/:shortId/link` with the commit hash and branch as a `github` link (reverse link)

The hook is opt-in. Repos without `.lock/config.json` are unaffected.

**Files:** new `packages/cli/src/commands/hook.ts`, the hook script itself

### `lock context --trailers` flag

Extend the existing context output to support a `--format=trailers` option that outputs `Decided-By: l-xxxxx "message"` lines, usable by git hooks or scripts.

**Files:** `packages/cli/src/commands/export.ts` or new dedicated command

---

## 2. Decision Reviews

Decisions with `scope: major` or `architectural` enter `proposed` status instead of `active`. Stakeholders approve before the decision becomes active.

### Flow

```
lock commit --scope major "Use notional value"
  → status: proposed
  → Slack notification with approve/reject reactions
  → N approvals → status: active
  → Rejected → status: reverted with reason
```

Minor decisions skip review and go straight to `active`.

### What exists

- `proposed` status is already in the DB schema
- Lock service always sets status to `active` — needs conditional logic
- No approval tracking fields yet

### Changes needed

- New fields on locks: `required_approvals` (int), `approvals` (jsonb array of {user, timestamp})
- Lock service: set `proposed` when scope >= major
- New endpoint: `POST /api/v1/locks/:shortId/approve`
- Slack: listen for emoji reactions on proposal notifications
- Configurable thresholds per product or feature

### Trade-off

Adds friction to the commit flow. Only build this when teams ask for governance — not before.

---

## 3. CI Decision Check (GitHub Action)

A GitHub Action that runs `lock check` against PR diffs and posts advisory comments.

### Workflow

```yaml
name: Lock Check
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check decisions
        env:
          LOCK_API_URL: ${{ secrets.LOCK_API_URL }}
          LOCK_API_KEY: ${{ secrets.LOCK_API_KEY }}
        run: lock check --intent "${{ github.event.pull_request.title }}" --product trading
```

Posts a PR comment listing relevant decisions. Advisory only — does not block merges.

### Prerequisite

Requires `lock check` CLI command (section 1).

---

## 4. Future: Entire.io Integration

Lock captures WHY (decisions). Entire captures HOW (agent sessions). Git is the meeting point.

### Shared contract

```
git commit -m "Refactor position display

Decided-By: l-a7f3e2
Entire-Session: s-7b2f4d"
```

Lock writes `Decided-By` trailers. Entire writes session references. Neither owns the other's data.

### Integration points

- Entire indexes `lock_check` / `lock_context` calls in agent sessions → proof that decisions were read before building
- Lock queries Entire for sessions referencing a decision → shows which agent sessions implemented it
- Cross-reference for drift detection: Lock knows the decisions, Entire knows what agents built

### No work needed now

The `Decided-By` trailer convention (section 1) is the foundation. It's useful standalone and is exactly the metadata Entire would index later.

---

## Priority order

| # | Feature | Effort | Prerequisite |
|---|---------|--------|-------------|
| 1 | Interactive `lock init` | Small | None |
| 2 | `lock check` CLI | Small | None |
| 3 | Git hook (`lock hook install`) | Medium | `lock check` CLI |
| 4 | CI GitHub Action | Small | `lock check` CLI |
| 5 | Decision Reviews | Medium | None |
| 6 | Entire.io integration | TBD | Git hook |
