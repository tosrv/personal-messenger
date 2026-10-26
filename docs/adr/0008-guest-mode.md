# 0008. Guest mode: chat with the owner without a Google account

- Status: Accepted
- Date: 2026-10-26

## Context

The PRD's main user is a portfolio visitor who wants to contact the owner (PRD §4, Flow A). Sign-in was Google-only (PRD §6.1). Visitors without a Google account, or who prefer not to use one, could not send a message at all.

Allowing accounts without Google weakens the main spam protection (PRD §14), because anyone can create guests freely.

## Decision

Add a **guest** account type, enabled by setting `OWNER_USERNAME`:

- `POST /api/v1/auth/guest` with `{ "display_name": "…" }` creates a user with `is_guest = true`, no Google identity and no email, and a generated username such as `guest_4821`. It then starts a normal session cookie ([ADR 0001](0001-database-backed-sessions.md)), so the rest of the app works unchanged.
- **Guests can only chat with the owner, in both directions.** A guest cannot start a chat with anyone else, and nobody but the owner can start a chat with a guest. Guests cannot search users, and they do not appear in search results.
- Guests can change their display name but not their username. Usernames starting with `guest` are reserved for guests, so nobody can impersonate one.
- Creating guests is rate-limited to 3 per minute per IP.
- Guests who never send a message are deleted after 7 days. Guests who did write are kept, so the owner keeps the conversation.
- `GET /api/v1/config` tells the web app whether guest mode is on and who the owner is.
- **No upgrade path:** a guest account lives only in the browser that holds its cookie. Converting a guest into a Google account can be added later.

## Consequences

- Visitors can reach the owner with one name field, which supports the PRD's hypothesis that an easy start matters most (PRD §2).
- Abuse is contained: a spammer can only message the owner, at a limited rate per IP. If that is not enough, a CAPTCHA (for example Cloudflare Turnstile) on `/auth/guest` is the next step.
- `users.google_sub` and `users.email` are nullable now. A CHECK constraint keeps them required for non-guests.
- PRD §6.1 ("sign in with Google") now has an exception that the PRD itself does not yet describe.
