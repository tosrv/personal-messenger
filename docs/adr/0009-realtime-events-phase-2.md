# 0009. Real-time events for typing, read receipts and presence

- Status: Accepted
- Date: 2026-10-29
- Amends: [ADR 0006](0006-send-over-rest-receive-over-websocket.md) (the socket is no longer strictly server-to-client)

## Context

Phase 2 of the PRD (§12) adds typing indicators, read receipts, online status / last seen, and in-app notifications. The socket today only pushes `message.new`, and clients may not send any data frames ([ADR 0006](0006-send-over-rest-receive-over-websocket.md)).

Typing indicators are frequent, short-lived and worthless a few seconds later. Sending each one as an HTTP request would cost a round trip, a session lookup and a CSRF check every few seconds while someone types. They are also never stored, so they do not need the guarantees REST gives sends (acknowledgement, idempotency, error codes).

Read receipts and presence change stored state (`conversation_members.last_read_message_id`, `users.last_seen_at`), or come from the connection itself.

## Decision

**One client-to-server frame, for typing only.** Everything that changes stored state still goes through REST.

```json
{ "type": "typing", "conversation_id": 7 }
```

The server handles each frame as follows:

| Check | On failure |
|---|---|
| Text frame of at most 512 bytes (the existing read limit) | Connection closed by the library (`1009`) |
| Valid JSON object, `type` is `typing`, `conversation_id` is a positive integer | Frame dropped, counts as a strike |
| Token bucket per connection: burst 5, refilled at 1 frame per second | Frame dropped, counts as a strike |
| Sender is a member of the conversation (checked in the database) | Frame dropped, counts as a strike |
| More than 20 strikes on one connection | Closed with `1008` (policy violation) |

The client throttles itself to one `typing` frame per conversation every 3 seconds while the user is typing, so the server limit is never reached in normal use.

**New server-to-client events.** Clients already ignore unknown types ([realtime.md](../realtime.md)), so old tabs keep working.

| Event | Payload | Sent to |
|---|---|---|
| `typing` | `conversation_id`, `user_id` | The other members' connections (not the sender's own tabs) |
| `conversation.read` | `conversation_id`, `user_id`, `last_read_message_id` | Every member's connections, including the reader's other tabs, when the read marker actually moved |
| `presence` | `user_id`, `online`, `last_seen_at` (or `null`) | Contacts allowed to see it ([ADR 0010](0010-presence-and-receipt-privacy.md)) |

- **Typing** is shown for 6 seconds after the last `typing` event, and cleared early when a `message.new` from that user arrives. Nothing is stored, and nothing is caught up after a reconnect.
- **Read receipts** reuse the existing read marker. `POST /conversations/:id/read` returns the same `204`, then pushes `conversation.read`. The conversation summary gains `peer_last_read_message_id`, so the client can rebuild receipts after a reconnect from the normal conversation refetch.
- **Presence**: a user is online while they have at least one open socket. When their last socket closes, the server stores `users.last_seen_at`. Conversation summaries gain `peer_presence` (`{ online, last_seen_at }`), omitted when privacy rules hide it.

PostgreSQL stays the source of truth for everything that is stored ([ADR 0003](0003-postgres-source-of-truth.md)). Presence's "online" bit lives in memory in the hub, which is valid for a single backend instance ([ADR 0005](0005-single-backend-instance.md)).

## Consequences

- Typing costs one small frame instead of one HTTP request. Send, read and settings changes keep the single tested REST path.
- The socket now has a read loop with validation, a per-connection rate limit and a strike limit. Each accepted `typing` frame costs one membership query, at most one per second per connection.
- Presence is per process. Running several instances would need a shared presence store, the same pub/sub layer already noted in [realtime.md](../realtime.md).
- A server restart briefly shows everyone as offline. Their `last_seen_at` is set to the restart time, and they come back online when they reconnect.
- Web Push is out of scope. Notifications only appear while a tab of the app is open ([ADR 0010](0010-presence-and-receipt-privacy.md)).
