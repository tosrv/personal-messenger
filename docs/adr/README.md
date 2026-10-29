# Architecture Decision Records

Each record captures one significant technical decision: the context, what was chosen, and the trade-offs accepted. Records are not edited after they are accepted; a changed decision gets a new record that supersedes the old one.

| # | Decision | Status |
|---|---|---|
| [0001](0001-database-backed-sessions.md) | Store sessions in PostgreSQL instead of using JWTs | Accepted |
| [0002](0002-single-origin.md) | Serve the frontend and API from one origin | Accepted |
| [0003](0003-postgres-source-of-truth.md) | PostgreSQL is the source of truth; WebSocket is only transport | Accepted |
| [0004](0004-fetch-and-tanstack-query.md) | Use `fetch` with TanStack Query instead of Axios | Accepted |
| [0005](0005-single-backend-instance.md) | Run a single backend instance for the MVP | Accepted |
| [0006](0006-send-over-rest-receive-over-websocket.md) | Send over REST, receive over WebSocket | Accepted |
| [0007](0007-single-image-behind-host-nginx.md) | Ship one image from GHCR, behind the host's nginx | Accepted |
| [0008](0008-guest-mode.md) | Guest mode: chat with the owner without a Google account | Accepted |
| [0009](0009-realtime-events-phase-2.md) | Real-time events for typing, read receipts and presence (amends 0006) | Accepted |
| [0010](0010-presence-and-receipt-privacy.md) | Privacy of presence, read receipts, typing and notifications | Accepted |

## Template

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context
What problem or force makes this decision necessary?

## Decision
What we chose.

## Consequences
What becomes easier, what becomes harder, and what we must do because of it.
```
