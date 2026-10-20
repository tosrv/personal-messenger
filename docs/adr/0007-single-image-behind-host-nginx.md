# 0007. Ship one image from GHCR, behind the host's nginx

- Status: Accepted
- Date: 2026-10-20

## Context

The VPS already runs nginx with certbot-managed certificates for other sites on `rahmattomy.com`. The app will live at `chat.rahmattomy.com`. The previous setup built two images (Go API, nginx serving the SPA) on the server and put Caddy in front for TLS. That would compete with the existing nginx for ports 80 and 443, and it needs the full repository and a build toolchain on the VPS.

## Decision

- **One image**, `ghcr.io/tosrv/personal-messenger`, built by CI after all tests pass. It contains the Go server and the built React app; the server serves the SPA itself (`STATIC_DIR`), so the frontend and API keep one origin ([ADR 0002](0002-single-origin.md)).
- **Tags:** `latest` and `sha-<commit>` on every push to `main`; `X.Y.Z` and `X.Y` for a `vX.Y.Z` git tag.
- **The host's nginx terminates TLS** (certbot) and proxies `chat.rahmattomy.com` to the app on `127.0.0.1:8080`, including WebSocket upgrades for `/ws`. Caddy is removed.
- **The VPS holds only** `compose.yaml`, `.env` and the backup scripts. Deploying is `docker compose pull && docker compose up -d`.

## Consequences

- No source code, Node or Go toolchain on the server; deploys take seconds.
- Frontend and backend are always the same version, and a version can be pinned with `IMAGE_TAG`. Rolling back means changing that tag.
- The app shares ports 80 and 443 with the other sites through the existing nginx and certbot.
- The app port is bound to loopback only, and the server trusts `X-Forwarded-For` only from private Docker ranges, so client IPs stay correct for rate limiting.
- TLS, security headers and compression are now configured in nginx ([infra/nginx/chat.rahmattomy.com.conf](../../infra/nginx/chat.rahmattomy.com.conf)) instead of a Caddyfile.
- Local development is unchanged: Docker Compose with the Vite dev server and hot reload.
