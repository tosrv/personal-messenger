# 0003. PostgreSQL is the source of truth; WebSocket is only transport

- Status: Accepted
- Date: 2026-10-19

## Context

Messages arrive in real time over WebSocket, but connections drop, users go offline, and clients retry. The PRD requires that confirmed messages survive restarts, that the UI never shows a message as sent without confirmation, and that retries never create visible duplicates (§6.5, §9).

## Decision

1. A message is **written to PostgreSQL before** the server acknowledges it or pushes it to anyone.
2. The client generates a `client_message_id` (UUID) for every message. The database enforces `UNIQUE (sender_id, client_message_id)`, so a retried send returns the already-stored message instead of inserting a new one.
3. Message IDs are increasing integers. After reconnecting, the client asks for messages newer than the last ID it has.
4. The WebSocket layer only pushes events. It holds no message state that is not also in the database.

## Consequences

- Delivery is effectively "at least once" over the wire and "exactly once" in storage and in the UI.
- Offline users lose nothing: they read history through the REST API.
- Each send costs one database write before the acknowledgement, adding a few milliseconds of latency. This fits the 500 ms delivery target.
- Sync after reconnect is a simple indexed query on `(conversation_id, id)`.
