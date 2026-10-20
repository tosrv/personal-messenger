# Personal Messenger

Self-hosted real-time messaging web app: Google login, user search, direct messages over WebSocket, persisted in PostgreSQL. See [docs/prd.md](docs/prd.md) for scope.

## Stack

| Layer    | Tech                                              |
|----------|---------------------------------------------------|
| Frontend | React, Vite, TypeScript, React Router, TanStack Query, Tailwind CSS v4 |
| Backend  | Go, Gin, pgx, golang-migrate                      |
| Database | PostgreSQL 17                                     |
| Infra    | Docker Compose, Caddy (automatic HTTPS)           |

## Layout

```
personal-messenger/
├── compose.yaml          # local dev stack (db + server + web)
├── .env.example          # config template — copy to .env
├── docs/                 # PRD and design notes
├── web/                  # React + Vite SPA
│   └── src/
│       ├── app/          # router, providers, layout
│       ├── features/     # auth/, users/, chat/, realtime/, system/ — api.ts + pages + tests
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
│   │   └── realtime/     # WebSocket hub                 (M4)
│   └── migrations/       # versioned SQL
└── infra/
    ├── compose.prod.yaml # production stack with Caddy
    ├── caddy/Caddyfile
    └── scripts/          # backup.sh, restore.sh
```

## Architecture

```
browser ──HTTPS──► Caddy ─┬─ /api/*, /ws ─► server (Go/Gin) ──► PostgreSQL
                          └─ /*          ─► web (nginx, static SPA)
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

```sh
cp .env.example .env    # set DOMAIN, POSTGRES_PASSWORD, SESSION_SECRET, Google OAuth
docker compose -f infra/compose.prod.yaml --env-file .env up -d --build
```

Caddy obtains and renews TLS certificates automatically. The [operations runbook](docs/operations.md) covers the full first deployment, updates and rollback, daily backups and restore, logs, troubleshooting, and the portfolio **Chat with me** link (`https://<DOMAIN>/u/<your-username>`).

## Security

- Google OpenID Connect with `state`, `nonce` and PKCE; sessions are opaque tokens stored hashed ([ADR 0001](docs/adr/0001-database-backed-sessions.md)).
- Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Origin checks block CSRF and cross-site WebSockets.
- Every conversation and message access is checked for membership on the server.
- Rate limits on sign-in, search, starting conversations and sending messages; messages are capped at 4,000 characters.
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
