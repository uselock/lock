# Lock Decision Check — GitHub Action

Automatically checks PRs against your team's locked product decisions and posts an advisory comment with relevant decisions.

## Usage

```yaml
# .github/workflows/lock-check.yml
name: Lock Decision Check
on:
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  check-decisions:
    runs-on: ubuntu-latest
    steps:
      - uses: uselock/lock/actions/check-decisions@main
        with:
          lock-api-url: ${{ secrets.LOCK_API_URL }}
          lock-api-key: ${{ secrets.LOCK_API_KEY }}
          product: trading  # optional
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `lock-api-url` | Yes | — | Lock API base URL |
| `lock-api-key` | Yes | — | Lock API key |
| `product` | No | — | Product slug to scope search |
| `comment-threshold` | No | `1` | Minimum decisions to post a comment |
| `github-token` | No | `${{ github.token }}` | GitHub token for posting comments |

## How it works

1. Reads the PR title and body
2. Searches the Lock API for semantically relevant decisions
3. Posts (or updates) a comment with matching decisions
4. Advisory only — never blocks the PR
