# 0006. Send over REST, receive over WebSocket

- Status: Accepted
- Date: 2026-10-20

## Context

Messages must arrive in real time (PRD §6.5). A sent message must not count as delivered until the server confirms it, and a retry must not create a duplicate. A WebSocket can carry traffic in both directions, so sending could go over it as well.

Sending over the socket would need its own request IDs and acknowledgement frames, and its own error codes and timeouts. It would also need its own validation, size limits, rate limiting and origin checks, all of which REST already has. And a send started just before a disconnect would be in an unknown state.

## Decision

- **Send** with `POST /api/v1/conversations/:id/messages`. The HTTP response is the acknowledgement: 201 when the message is newly stored, 200 when it is an idempotent retry ([ADR 0003](0003-postgres-source-of-truth.md)).
- **Receive** over `GET /ws`, which is **server-to-client only**. After a message is committed, the server pushes `message.new` to every connection of every member of the conversation, including the sender's other tabs.
- After every (re)connect, the client fetches what it missed with `GET …/messages?after=<newest id it has>`.

The protocol is described in [realtime.md](../realtime.md).

## Consequences

- A single, tested write path: validation, idempotency, CSRF and origin checks, and limits apply equally to all sends.
- Acknowledgements and errors use ordinary HTTP status codes, and the existing retry UI works unchanged.
- The socket protocol is a handful of event types, so it is easy to test and extend later (typing indicators, read receipts).
- A send costs one HTTP round trip instead of one socket frame. That is negligible at this scale: about 17 ms end to end locally, against a 500 ms target.
- An event can arrive before the sender's HTTP response. The client merges both by message ID and `client_message_id`, so nothing is shown twice.
