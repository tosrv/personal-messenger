# 0002. Serve the frontend and API from one origin

- Status: Accepted (production routing updated by [ADR 0007](0007-single-image-behind-host-nginx.md): one app container behind the host's nginx; the single-origin decision is unchanged)
- Date: 2026-10-19

## Context

The React app and the Go API are separate services. If they live on different origins (for example `app.example.com` and `api.example.com`), session cookies become cross-site: they need `SameSite=None`, CORS with credentials must be configured exactly right, and some browsers block third-party cookies entirely.

## Decision

Expose both under one origin and route by path:

- Production: Caddy sends `/api/*` and `/ws` to the Go server and everything else to the static frontend (`infra/caddy/Caddyfile`).
- Development: the Vite dev server proxies `/api` and `/ws` to the Go server (`web/vite.config.ts`).

The frontend always calls relative URLs such as `/api/v1/me`.

## Consequences

- Session cookies are first-party and can use `SameSite=Lax`, which also blocks most CSRF from other sites.
- No CORS is needed in normal operation. The server keeps a strict origin allowlist only as a safety net.
- The frontend needs no per-environment API URL.
- The API and frontend cannot be scaled or hosted on different domains without revisiting this decision.
- WebSocket `Origin` checks still need to be enforced on the server (PRD §8).
