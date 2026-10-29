# Real-time Protocol

Personal Messenger pushes new messages to browsers over a WebSocket. Sending still goes through the REST API ([ADR 0006](adr/0006-send-over-rest-receive-over-websocket.md)), and PostgreSQL stays the source of truth ([ADR 0003](adr/0003-postgres-source-of-truth.md)).

## Connecting

```
GET /ws   (Upgrade: websocket)
```

| Check | Failure |
|---|---|
| Valid `pm_session` cookie (sent automatically, same origin) | `401` before upgrade |
| `Origin` is in `ALLOWED_ORIGINS` | `403` before upgrade |

In development, Vite proxies `/ws` to the Go server. In production, the host's nginx does the same (`location = /ws` in [infra/nginx](../infra/nginx/chat.rahmattomy.com.conf), with `Upgrade` headers and a 120 s read timeout).

## Server → client events

Every frame is a JSON text message with a `type`.

### `ready`

Sent once, right after the connection opens. The client treats this as "online" and starts its catch-up (see [Reconnecting](#reconnecting)).

```json
{ "type": "ready" }
```

### `message.new`

A message was stored in a conversation the user belongs to. It is sent to every open connection of every member, including the sender (so their other tabs update).

```json
{
  "type": "message.new",
  "message": {
    "id": 42,
    "conversation_id": 7,
    "sender_id": 1,
    "client_message_id": "6f1c2c1e-3a5b-4c1d-9e2f-1a2b3c4d5e6f",
    "body": "Hello!",
    "created_at": "2026-10-20T08:01:00Z"
  }
}
```

### `typing`

The other member of the conversation is typing ([ADR 0009](adr/0009-realtime-events-phase-2.md)). Sent only to the other members' connections, never stored. The client shows "typing…" for 6 s after the last event, and clears it early when a `message.new` from that user arrives.

```json
{ "type": "typing", "conversation_id": 7, "user_id": 2 }
```

### `conversation.read`

A member moved their read marker forward (`POST /api/v1/conversations/:id/read`). Sent to every member: the other member uses it for read receipts, and the reader's other tabs refresh unread counts. Sent only when the marker actually moved. After a reconnect, the conversation summary's `peer_last_read_message_id` restores receipts.

```json
{ "type": "conversation.read", "conversation_id": 7, "user_id": 2, "last_read_message_id": 42 }
```

The client must ignore event types it does not recognise, so new events can be added without breaking old tabs.

## Client → server

The only data frame a client may send is the ephemeral typing signal ([ADR 0009](adr/0009-realtime-events-phase-2.md)):

```json
{ "type": "typing", "conversation_id": 7 }
```

The web client sends it at most once every 3 s per conversation while the user types. The server checks every frame:

| Check | On failure |
|---|---|
| Text frame of at most 512 bytes | Connection closed (`1009`) |
| JSON object with exactly `type: "typing"` and a positive `conversation_id` | Dropped, one strike |
| Per-connection token bucket: burst 5, 1 frame per second | Dropped, one strike |
| Sender is a member of the conversation | Dropped, one strike |
| More than 20 strikes | Connection closed (`1008`) |

Everything that changes stored state goes through REST. Messages are sent with:

```
POST /api/v1/conversations/:id/messages
{ "client_message_id": "<uuid>", "body": "..." }
```

`201` means the message was stored. `200` means the same `client_message_id` was already stored, and the original message is returned.

## Keep-alive and closing

| Situation | What happens |
|---|---|
| Every 30 s | The server sends a ping and re-checks the session. If the user signed out or the session expired, the server closes with `1008` (policy violation). |
| Ping not answered within 10 s | The server closes the connection. |
| The client cannot keep up (64 queued events) | The server closes with `1013` (try again later). The client reconnects and catches up. |
| Server shutdown or restart | The server closes all sockets with `1013`. |

## Reconnecting

The browser client is in [`web/src/lib/realtime.ts`](../web/src/lib/realtime.ts).

1. When a connection closes, the client waits and then reconnects, with exponential backoff and jitter: about 1 s, 2 s, 4 s … capped at 30 s. The wait is reset after a successful connection.
2. When the browser fires `online`, or the tab becomes visible again, the client skips the wait and reconnects immediately.
3. On every `ready`, the client calls `syncAll()`. For each conversation it has loaded, this fetches `GET …/messages?after=<newest id it has>` until `has_more` is false, then refreshes the conversation list.
4. While disconnected, the app also polls every 15 s, in case only WebSockets are blocked (some proxies do this). After about 1.5 s offline, a banner tells the user that live updates are paused.

Because every message has a unique `id`, the client merges REST results and pushed events by ID. Duplicates are dropped. Pending sends are matched by `client_message_id`.

## Scaling note

Connections are tracked in memory by one server instance ([ADR 0005](adr/0005-single-backend-instance.md)). Running more than one instance would need a pub/sub layer (for example PostgreSQL `LISTEN/NOTIFY` or Redis) behind `realtime.Hub`.
