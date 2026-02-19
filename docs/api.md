# REST API Reference

The Lock core API powers all surfaces (Slack, CLI, MCP). You can also call it directly to build custom integrations.

**Base URL:** `https://your-lock-instance.com/api/v1`

## Authentication

All `/api/v1/*` endpoints require authentication via one of:

### Bearer Token (API Keys)

```
Authorization: Bearer lk_a7f3e2d4...
```

API keys are created through the Lock admin UI. Each key is a `lk_` prefix + 32 hex characters.

### Internal Service Auth

For service-to-service communication (e.g., Slack bot to core API):

```
X-Internal-Secret: your-shared-secret
X-Workspace-Team-Id: T1234567
```

## Response Format

All successful responses are wrapped in a `data` envelope:

```json
{
  "data": {
    "locks": [...]
  }
}
```

All error responses:

```json
{
  "error": {
    "code": "LOCK_NOT_FOUND",
    "message": "No lock found with ID l-a7f3e2"
  }
}
```

**Status codes:** `200` / `201` for success, `400` for validation errors, `401` for unauthorized, `404` for not found, `409` for conflicts (duplicate slugs), `500` for internal errors.

---

## Locks

### Create a Lock

```
POST /api/v1/locks
```

Record a new product decision.

**Request body:**

```json
{
  "message": "Use notional value instead of margin for position display",
  "product": "trading",
  "feature": "margin-rework",
  "scope": "major",
  "tags": ["display", "margin"],
  "author": {
    "type": "human",
    "id": "U1234567",
    "name": "philippe",
    "source": "slack"
  },
  "source": {
    "type": "slack",
    "ref": "https://myteam.slack.com/archives/C123/p456",
    "context": "Thread discussion about margin vs notional...",
    "participants": ["philippe", "alice", "bob"]
  },
  "links": [
    { "type": "jira", "ref": "TRADE-442" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | The decision statement |
| `product` | string | Yes | Product slug (auto-created if new) |
| `feature` | string | Yes | Feature slug (auto-created if new) |
| `scope` | string | No | `minor` (default), `major`, or `architectural` |
| `tags` | string[] | No | Free-form labels |
| `author.type` | string | Yes | `human` or `agent` |
| `author.id` | string | Yes | Unique identifier (user ID, agent name) |
| `author.name` | string | Yes | Display name |
| `author.source` | string | Yes | `slack`, `cli`, `mcp`, or `api` |
| `source.type` | string | Yes | `slack`, `cli`, `agent_session`, or `api` |
| `source.ref` | string | No | Thread URL, session ID, etc. |
| `source.context` | string | No | Surrounding discussion |
| `source.participants` | string[] | No | Participant names |
| `links` | array | No | External references |
| `links[].type` | string | Yes | `jira`, `figma`, `github`, `linear`, `notion`, or `other` |
| `links[].ref` | string | Yes | Ticket ID, URL, etc. |

**Response (201):**

```json
{
  "data": {
    "lock": {
      "id": "uuid",
      "short_id": "l-a7f3e2",
      "message": "Use notional value instead of margin for position display",
      "product": { "slug": "trading", "name": "Trading" },
      "feature": { "slug": "margin-rework", "name": "Margin Rework" },
      "author": { "type": "human", "id": "U1234567", "name": "philippe", "source": "slack" },
      "scope": "major",
      "status": "active",
      "tags": ["display", "margin"],
      "created_at": "2026-02-19T14:32:00Z"
    },
    "conflicts": [
      {
        "lock": {
          "short_id": "l-b8c4f1",
          "message": "Display all values in margin terms",
          "scope": "minor",
          "feature": { "slug": "position-display", "name": "Position Display" },
          "created_at": "2026-02-10T..."
        },
        "relationship": "potential_conflict",
        "explanation": "These decisions contradict each other on what metric to display for positions."
      }
    ],
    "supersession": {
      "detected": true,
      "supersedes": {
        "short_id": "l-x9y2z3",
        "message": "Use margin for position display"
      },
      "explanation": "The new decision directly replaces the approach described in l-x9y2z3."
    }
  }
}
```

---

### Extract a Decision from Context

```
POST /api/v1/locks/extract
```

Uses an LLM to extract a decision statement from thread context. Used by the Slack bot's extract and polish modes.

**Request body:**

```json
{
  "thread_context": "philippe: what should we use for position display?\nalice: notional value makes more sense than margin\nphilippe: agreed, let's go with that",
  "user_hint": "we're using notional value"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `thread_context` | string | Yes | Thread conversation text |
| `user_hint` | string | No | User's rough phrasing to polish (triggers polish mode) |

**Response (200):**

```json
{
  "data": {
    "decision": "Use notional value instead of margin for position display",
    "scope": "major",
    "tags": ["display", "margin"],
    "confidence": 0.92,
    "reasoning": "The team discussed margin vs notional and agreed on notional."
  }
}
```

---

### Update a Lock

```
PATCH /api/v1/locks/:shortId
```

Update mutable fields on a lock (scope, tags). The decision message itself is immutable.

**Request body:**

```json
{
  "scope": "major",
  "tags": ["display", "margin"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scope` | string | No | New scope value |
| `tags` | string[] | No | New tags array |

**Response (200):** Updated lock object.

---

### List Locks

```
GET /api/v1/locks
```

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `product` | string | Filter by product slug |
| `feature` | string | Filter by feature slug |
| `scope` | string | Filter by scope |
| `status` | string | Filter by status |
| `author` | string | Filter by author name |
| `tags` | string | Filter by tag |
| `limit` | number | Max results (default: 20) |
| `offset` | number | Pagination offset (default: 0) |

**Response (200):**

```json
{
  "data": {
    "locks": [...],
    "total": 42
  }
}
```

---

### Get a Lock

```
GET /api/v1/locks/:shortId
```

Returns full details including metadata, links, and lineage.

**Response (200):**

```json
{
  "data": {
    "lock": {
      "id": "uuid",
      "short_id": "l-a7f3e2",
      "message": "...",
      "product": { "slug": "trading", "name": "Trading" },
      "feature": { "slug": "margin-rework", "name": "Margin Rework" },
      "author": { "type": "human", "id": "U1234567", "name": "philippe", "source": "slack" },
      "scope": "major",
      "status": "active",
      "tags": ["display", "margin"],
      "source": {
        "type": "slack",
        "ref": "https://...",
        "context": "Thread discussion...",
        "participants": ["philippe", "alice"]
      },
      "lineage": {
        "supersedes_id": "uuid or null",
        "superseded_by_id": "uuid or null",
        "reverted_by_id": "uuid or null"
      },
      "links": [
        { "type": "jira", "ref": "TRADE-442" }
      ],
      "created_at": "2026-02-19T14:32:00Z"
    }
  }
}
```

---

### Get Lineage

```
GET /api/v1/locks/:shortId/lineage
```

Returns the full supersession/revert chain for a decision.

**Response (200):**

```json
{
  "data": {
    "chain": [
      {
        "short_id": "l-x9y2z3",
        "message": "Use margin for position display",
        "status": "superseded",
        "scope": "major",
        "created_at": "2026-01-10T...",
        "relationship": "root"
      },
      {
        "short_id": "l-a7f3e2",
        "message": "Use notional value instead of margin",
        "status": "active",
        "scope": "major",
        "created_at": "2026-02-15T...",
        "relationship": "supersedes"
      }
    ]
  }
}
```

---

### Revert a Lock

```
POST /api/v1/locks/:shortId/revert
```

**Request body:**

```json
{
  "message": "Requirements changed — margin is needed after all",
  "author": {
    "type": "human",
    "id": "U1234567",
    "name": "philippe",
    "source": "cli"
  }
}
```

**Response (200):**

```json
{
  "data": {
    "reverted": {
      "short_id": "l-a7f3e2",
      "message": "Use notional value instead of margin",
      "status": "reverted"
    },
    "revert_lock": {
      "short_id": "l-m1n2o3",
      "message": "Requirements changed — margin is needed after all",
      "status": "active",
      "created_at": "2026-02-19T..."
    }
  }
}
```

Only active locks can be reverted.

---

### Add Link

```
POST /api/v1/locks/:shortId/link
```

**Request body:**

```json
{
  "link_type": "jira",
  "link_ref": "TRADE-442"
}
```

**Response (201):**

```json
{
  "data": {
    "link": {
      "type": "jira",
      "ref": "TRADE-442"
    }
  }
}
```

---

### Semantic Search

```
POST /api/v1/locks/search
```

**Request body:**

```json
{
  "query": "how do we handle margin calculations",
  "product": "trading",
  "feature": "margin-rework"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Natural language search query |
| `product` | string | No | Scope to a product |
| `feature` | string | No | Scope to a feature |

**Response (200):**

```json
{
  "data": {
    "locks": [
      {
        "short_id": "l-a7f3e2",
        "message": "Use notional value instead of margin",
        "product": { "slug": "trading", "name": "Trading" },
        "feature": { "slug": "margin-rework", "name": "Margin Rework" },
        "scope": "major",
        "status": "active",
        "similarity": 0.89,
        "created_at": "2026-02-15T..."
      }
    ]
  }
}
```

Falls back to text search (ILIKE) if embeddings are unavailable.

---

## Products

### List Products

```
GET /api/v1/products
```

**Response (200):**

```json
{
  "data": {
    "products": [
      {
        "slug": "trading",
        "name": "Trading",
        "description": "Core trading platform",
        "lock_count": 12,
        "created_at": "2026-02-01T..."
      }
    ]
  }
}
```

### Create Product

```
POST /api/v1/products
```

```json
{
  "slug": "trading",
  "name": "Trading",
  "description": "Core trading platform"
}
```

Returns `409` if the slug already exists in the workspace.

### Update Product

```
PATCH /api/v1/products/:slug
```

```json
{
  "name": "Trading Platform",
  "description": "Updated description"
}
```

---

## Features

### List Features

```
GET /api/v1/features
GET /api/v1/features?product=trading
```

### Create Feature

```
POST /api/v1/features
```

```json
{
  "slug": "margin-rework",
  "name": "Margin Rework",
  "product": "trading",
  "description": "Migrating to notional value"
}
```

Auto-creates the product if it doesn't exist.

### Update Feature

```
PATCH /api/v1/features/:slug
```

```json
{
  "name": "Margin Rework v2",
  "description": "Updated scope",
  "product": "trading"
}
```

---

## Channel Configs

### Create/Update Channel Config

```
POST /api/v1/channel-configs
```

Maps a Slack channel to a product and feature. Upserts if the channel already has a config.

```json
{
  "slack_channel_id": "C1234567",
  "product": "trading",
  "feature": "margin-rework"
}
```

### Get Channel Config

```
GET /api/v1/channel-configs/:channelId
```

Returns `404` if the channel is not configured.

---

## Health Check

```
GET /health
```

No authentication required.

```json
{
  "status": "ok",
  "timestamp": "2026-02-19T14:32:00Z"
}
```
