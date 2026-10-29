# 0010. Privacy of presence, read receipts, typing and notifications

- Status: Accepted
- Date: 2026-10-29

## Context

The events in [ADR 0009](0009-realtime-events-phase-2.md) reveal behaviour: when someone is online, when they were last seen, whether they read a message, and when they are typing. The PRD asks to keep email private (§6.2) and to protect visitors who reach the owner, including guests who have no verified identity ([ADR 0008](0008-guest-mode.md)).

## Decision

**Who can see anything at all.** Only *contacts*, meaning users who share a conversation with you. Presence, receipts and typing never appear on public profiles, in search results, or to anyone else.

**Online status and last seen**

- Each account has a **Show online status** setting (`users.show_presence`), on by default, changed in Settings → Profile (`PATCH /api/v1/me` with `show_presence`).
- When it is off, nobody sees whether you are online or when you were last seen.
- It is **reciprocal**, like WhatsApp: when you hide yours, you also stop seeing other people's. The server enforces both directions. Conversation summaries omit `peer_presence`, and `presence` events are neither sent about you nor to you.
- Turning it off immediately sends contacts a `presence` event with `online: false` and `last_seen_at: null`, so their screens drop it. Turning it back on sends your current state.
- `last_seen_at` is stored to the second and shown rounded ("last seen 5 min ago", "last seen yesterday at 21:04").

**Read receipts** are always on for every account in this phase, and only the other member of the conversation sees them. A toggle can be added later if it is needed.

**Typing** is always on, sent only to the other member, and never stored.

**Guests** follow exactly the same rules. Because a guest can only have a conversation with the owner, a guest's presence, receipts and typing are visible **only to the owner**. A guest sees the owner's presence only if the owner shows it. Guests can change the setting in their own settings, like everyone else. Guest retention ([ADR 0008](0008-guest-mode.md)) also removes `last_seen_at` with the account.

**Notifications** are in-app only. No Web Push and no service worker.

- Unread count in the tab title, for example `(3) Personal Messenger`.
- Optional sound for new messages, off by default.
- Optional system notifications through the browser Notification API, shown only while the tab is hidden. They are off until the user turns them on, which asks the browser for permission.
- Preferences are stored per device in `localStorage`, like the theme. Nothing is stored on the server.
- Messages you sent, and messages in the chat you are looking at while the tab is visible, never notify.
- System notifications show the sender's name and the first 100 characters of the message, which can be read by anyone looking at the screen. The setting's hint says so.

## Consequences

- One setting covers presence, which keeps the UI simple. Reciprocity makes it fair and discourages hiding while watching others.
- Read receipts cannot be hidden yet. This is a deliberate scope cut, written down here so it can be revisited.
- An owner who hides their presence from guests also stops seeing guests' presence.
- Without Web Push, nothing notifies anyone who has no tab of the app open. That matches the PRD's non-goal of a complex push notification system.
