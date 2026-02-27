# @uselock/cli

CLI for [Lock](https://github.com/GuitareCiel/lock) — track product decisions where they happen.

Lock captures product decisions ("let's use notional value instead of margin here") with full context, so your team always knows why something was built a certain way.

## Install

```bash
npm install -g @uselock/cli
```

## Setup

```bash
lock login --url https://your-lock-server.com --key lk_...
lock init --product trading --feature margin-engine
```

## Usage

```bash
# Record a decision
lock "Use notional value instead of margin for position sizing"

# Record with metadata
lock commit "Switch to WebSocket for real-time updates" --scope major --tag backend --ticket TRADE-442

# Check for conflicts before building
lock check "add retry logic to order submission"

# View recent decisions
lock log --product trading

# Search decisions
lock search "authentication flow"

# Export decisions to markdown
lock export --product trading --output LOCK.md
```

## Documentation

Full documentation: [github.com/GuitareCiel/lock/tree/main/docs/cli.md](https://github.com/GuitareCiel/lock/tree/main/docs/cli.md)

## License

MIT
