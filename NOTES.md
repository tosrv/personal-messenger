# Notes

## Assumptions (Phase 2, branch `claude/fase-2`)

- **Read receipts have no toggle** in this phase. Only presence gets a privacy setting, as the task asked. Recorded in ADR 0010.
- **Presence toggle is reciprocal** (hide yours → you don't see others'), like WhatsApp. Recorded in ADR 0010.
- **Guests follow the same rules as everyone.** Since they only talk to the owner, only the owner can see their presence, receipts and typing.
- **"Delete chat" moves the read marker** (existing behaviour from migration 000003), so deleting an unread chat shows the sender "Read". Accepted for now rather than adding a separate column.
- **Notification preferences are per device** (`localStorage`), like the theme, so no migration or API is needed.
- **Typing has no explicit "stopped" event.** The indicator expires 6 s after the last event, or when that user's message arrives.

## Environment

- Windows Application Control blocks some locally built Go test binaries (`user.test.exe`, sometimes `middleware.test.exe`). Go checks are run in a `golang:1.26` container on the compose network, against the `messenger_test` database.
- `npm run check` was already failing on `main`: Prettier flagged `web/src/components/States.tsx`. It is fixed in a separate formatting-only commit.

## Summary (Phase 2)

### Done

| Commit | What |
|---|---|
| `docs: ADR 0009 … ADR 0010` | WebSocket protocol for new events; privacy policy (incl. guests) |
| `feat: typing indicator` | Client `typing` frame: validated, per-connection rate limit (burst 5, 1/s), membership check, strike limit → close `1008`. Client throttles to 1 frame / 3 s per chat; indicator times out after 6 s or on that user's message |
| `feat: read receipts` | `conversation.read` event when the read marker moves; `peer_last_read_message_id` in summaries; ✓ Sent / ✓✓ Read on your own messages |
| `feat: online status and last seen` | Migration 000005 (additive: `show_presence` default true, `last_seen_at` nullable); `presence` events to contacts only, reciprocal toggle in Settings → Profile; `peer_presence` in summaries |
| `feat: in-app notifications` | Unread count in the tab title, optional chime, Notification API while the tab is hidden; Settings → Notifications; no Web Push, no service worker |

Also: a Prettier fix for `States.tsx` (was failing on `main`), and updates to `docs/realtime.md`, `docs/database.md`, README and CLAUDE.md. Separately, on branch `claude/prd-guest-mode`, the PRD now describes guest mode (ADR 0008).

Checks on the final commit: Go `gofmt`, `go vet`, `go test -race -count=1 ./...` with `TEST_DATABASE_URL`, and `go build`, all green (run in Docker, see Environment). Web: `npm run check` (typecheck, oxlint, prettier, 114 Vitest tests) and `npm run build`, all green. No existing test was removed or weakened. One expectation was extended: the settings menu test now also expects "Notifications".

### Skipped / not done

- **Web Push**: out of scope, as instructed.
- **Toggle for read receipts**: not built (ADR 0010).
- **Not pushed** to any remote, and nothing deployed. Deploy workflow, credentials and VPS untouched.
- **The running dev stack (`docker compose`) was not rebuilt**: it still runs the old server image. Migration 000005 runs automatically on the next server start.

### Needs manual testing (two browsers, two accounts)

1. **Typing**: A types → B sees "typing…" in the header and in the list; it disappears about 6 s after A stops, or as soon as A's message arrives.
2. **Read receipts**: A sends → single tick. B opens the chat → A's tick turns into a double tick without a reload. Also check after A reconnects (go offline/online).
3. **Presence**: B sees "online" and a green dot while A has a tab open. Closing all of A's tabs → "last seen just now". A turns off *Show online status* → B's view drops it immediately, and A no longer sees B's. Repeat with a **guest** ↔ owner pair.
4. **Notifications**: enable sound → chime on a message from another chat; no chime for your own messages or the open chat while visible. Enable system notifications → browser permission prompt; with the tab in the background, a notification appears; clicking it focuses the tab and opens that chat. Check the "(N) Personal Messenger" title.
5. **Real browsers**: autoplay rules may mute the first chime until the user interacts with the page. Safari / iOS handle the Notification API differently, and iOS shows nothing without Web Push.
6. **nginx in production**: client→server frames go through the existing `/ws` proxy; check that the frames and a 30 s idle period are fine behind nginx.
