# Personal Messenger

Self-hosted real-time messaging web app: Google login, user search, direct messages over WebSocket, persisted in PostgreSQL. See [docs/prd.md](docs/prd.md) for scope.

## Stack

| Layer    | Tech                                              |
|----------|---------------------------------------------------|
| Frontend | React, Vite, TypeScript, React Router, TanStack Query, Tailwind CSS v4 |
| Backend  | Go, Gin, pgx, golang-migrate                      |
| Database | PostgreSQL 17                                     |
| Infra    | Docker, one image on GHCR, host nginx + certbot, GitHub Actions CI |

## Layout

```
personal-messenger/
├── compose.yaml          # local dev stack (db + server + web)
├── .env.example          # config template — copy to .env
├── docs/                 # PRD and design notes
├── web/                  # React + Vite SPA
│   └── src/
│       ├── app/          # router, providers, layout
│       ├── features/     # auth/, users/, chat/, realtime/, notifications/, settings/, system/
│       ├── components/   # shared UI (states, avatar, error boundary)
│       ├── lib/          # fetch wrapper, WebSocket client, safe redirect, time
│       └── test/         # Vitest setup + render helpers
├── server/               # Go API
│   ├── cmd/api/          # entrypoint
│   ├── internal/
│   │   ├── config/       # env config
│   │   ├── database/     # pgx pool + migrations runner
│   │   ├── httpapi/      # router, handlers
│   │   ├── middleware/   # logging, CORS (auth later)
│   │   ├── auth/         # Google OIDC + sessions        (M2)
│   │   ├── user/         # profiles + search             (M2)
│   │   ├── conversation/ # DMs + membership              (M3)
│   │   ├── message/      # persistence + pagination      (M3)
│   │   └── realtime/     # WebSocket hub, typing, presence (M4, Phase 2)
│   └── migrations/       # versioned SQL
└── infra/
    ├── compose.prod.yaml # production stack (app image + db), copied to the VPS
    ├── nginx/            # host nginx site for chat.rahmattomy.com
    └── scripts/          # backup.sh, restore.sh
```

## Architecture

```
production:  browser ──HTTPS──► nginx (host, certbot) ──► app container ──► PostgreSQL
                                                         Go API + built SPA
development: browser ──► Vite dev server ─┬─ /api, /ws ─► Go server ──► PostgreSQL
                                          └─ /*         ─► React (hot reload)
```

Frontend and API share one origin, so session cookies stay first-party (`SameSite=Lax`). In dev, Vite proxies `/api` and `/ws` to the Go server for the same effect. PostgreSQL is the source of truth; WebSocket is only transport. Messages carry a client-generated `client_message_id` (unique per sender) so retries are idempotent.

## Local development

```sh
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:5173 (shows API health)
- API: http://localhost:8080/healthz, `/readyz` (checks DB), `/api/v1/health`

Migrations run automatically when the server starts.

Running services outside Docker:

```sh
docker compose up db
cd server && go run ./cmd/api      # reads DATABASE_URL etc. from your shell env
cd web && npm install && npm run dev
```

Postgres is published on host port **5433** (not 5432) so it does not clash with a locally installed Postgres. Override with `POSTGRES_HOST_PORT`.

Checks:

```sh
cd server && go vet ./... && go test ./...
cd web && npm run check    # typecheck + oxlint + prettier + vitest
```

Integration tests (repositories, sessions) run against a real database and are skipped unless `TEST_DATABASE_URL` is set:

```sh
docker compose exec db psql -U messenger -c "CREATE DATABASE messenger_test"   # once
cd server && TEST_DATABASE_URL=postgres://messenger:messenger@localhost:5433/messenger_test?sslmode=disable go test -p 1 ./...
```

### Google sign-in

Create an OAuth client (type *Web application*) in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) with:

- Authorized JavaScript origin: `http://localhost:5173`
- Authorized redirect URI: `http://localhost:5173/api/v1/auth/callback`

Put the client ID and secret in `.env`. Without `GOOGLE_CLIENT_ID` the server still starts, but sign-in is disabled.

## Configuration

All config comes from environment variables; see [.env.example](.env.example). Secrets never go in the repo (`.env` is git-ignored).

## Deployment (VPS)

CI builds one image with the API and the frontend and publishes it as `ghcr.io/tosrv/personal-messenger` (`latest` for `main`, `X.Y.Z` for `vX.Y.Z` tags). The VPS needs no source code, only `compose.yaml` and `.env`:

```sh
cd /opt/personal-messenger
docker compose pull && docker compose up -d
```

The host's nginx (with certbot) serves `https://chat.rahmattomy.com` and proxies to the app on `127.0.0.1:8080` ([ADR 0007](docs/adr/0007-single-image-behind-host-nginx.md)). The [operations runbook](docs/operations.md) covers the first deployment, nginx and certbot, updates and rollback, backups and restore, logs, troubleshooting, and the portfolio **Chat with me** link (`https://chat.rahmattomy.com/u/<your-username>`).

To build the production image locally: `docker build -t personal-messenger .`

## Security

- Google OpenID Connect with `state`, `nonce` and PKCE; sessions are opaque tokens stored hashed ([ADR 0001](docs/adr/0001-database-backed-sessions.md)).
- Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Origin checks block CSRF and cross-site WebSockets.
- Every conversation and message access is checked for membership on the server.
- Rate limits on sign-in, guest creation, search, starting conversations and sending messages; messages are capped at 4,000 characters.
- Optional guest mode ([ADR 0008](docs/adr/0008-guest-mode.md)): visitors without a Google account can chat with the owner only.
- HTTPS with HSTS, a strict Content Security Policy, and logs that never contain tokens, emails or message bodies.

## Documentation

- [Product requirements](docs/prd.md)
- [Database design](docs/database.md)
- [Real-time protocol](docs/realtime.md)
- [Operations runbook](docs/operations.md)
- [Architecture decision records](docs/adr/README.md)

## Roadmap

- [x] M1 Foundation — repo layout, Gin, Vite, Postgres, health check, first migration
- [x] M2 Auth & profiles — Google OIDC, sessions, usernames, search
- [x] M3 Messaging API — conversations, messages, pagination, membership checks
- [x] M4 Real-time — WebSocket push, reconnect with backoff, catch-up sync, idempotent sends
- [ ] M5 Production readiness — rate limiting, CI, hardened HTTPS stack, backup/restore drill, runbook ✓ · **remaining:** deploy to a VPS with a domain, link from the portfolio
- [x] Phase 2 — typing indicators, read receipts, online status / last seen with a privacy toggle, in-app notifications (tab badge, optional sound, system notifications while the tab is hidden; no Web Push). See [ADR 0009](docs/adr/0009-realtime-events-phase-2.md) and [ADR 0010](docs/adr/0010-presence-and-receipt-privacy.md).
