# 0001. Store sessions in PostgreSQL instead of using JWTs

- Status: Accepted
- Date: 2026-10-19

## Context

After a user signs in with Google, the app needs to remember them across requests and WebSocket connections. The PRD requires that signing out invalidates the session on the server (§8) and that session IDs never appear in logs.

The two common options are:

- **Stateless JWT** in a cookie: no database lookup per request, but a token stays valid until it expires. Revoking it early needs a denylist, which is server-side state anyway.
- **Opaque session token** in a cookie, looked up in the database: one indexed query per request, but revocation is a single `DELETE`.

## Decision

Use an opaque, random session token stored in an `HttpOnly` cookie (`Secure` in production, `SameSite=Lax`). The database stores only the **SHA-256 hash** of the token in the `sessions` table, with `user_id` and `expires_at`.

## Consequences

- Sign-out, "sign out everywhere", and banning a user take effect immediately.
- A leaked database dump does not contain usable session tokens.
- Every authenticated request and WebSocket handshake costs one primary-key lookup. At MVP scale this is negligible.
- Expired rows must be cleaned up periodically (indexed by `expires_at`).
- The Google ID token is used only during sign-in and is never stored as the session.
