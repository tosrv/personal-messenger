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
