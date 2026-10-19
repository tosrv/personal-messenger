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
│       ├── features/     # auth/, users/, system/ (chat/ in M3) — api.ts + pages + tests
│       ├── components/   # shared UI (states, avatar, error boundary)
│       ├── lib/          # fetch wrapper, safe redirect
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

Checks:

```sh
cd server && go vet ./... && go test ./...
cd web && npm run check    # typecheck + oxlint + prettier + vitest
```

## Configuration

All config comes from environment variables; see [.env.example](.env.example). Secrets never go in the repo (`.env` is git-ignored).

## Deployment (VPS)

1. Point your domain's DNS A/AAAA record at the VPS.
2. On the VPS: clone the repo, `cp .env.example .env`, set `DOMAIN`, strong `POSTGRES_PASSWORD`, `SESSION_SECRET`, and Google OAuth values (redirect `https://<DOMAIN>/api/v1/auth/callback`).
3. `docker compose -f infra/compose.prod.yaml --env-file .env up -d --build`

Caddy obtains and renews TLS certificates automatically.

### Backups

```sh
sh infra/scripts/backup.sh                       # → backups/messenger-<timestamp>.sql.gz
sh infra/scripts/restore.sh backups/<file>.sql.gz
```

Schedule `backup.sh` with cron and copy backups off the server.

## Documentation

- [Product requirements](docs/prd.md)
- [Database design](docs/database.md)
- [Architecture decision records](docs/adr/README.md)

## Roadmap

- [x] M1 Foundation — repo layout, Gin, Vite, Postgres, health check, first migration
- [ ] M2 Auth & profiles — Google OIDC, sessions, usernames, search
- [ ] M3 Messaging API — conversations, messages, pagination, membership checks
- [ ] M4 Real-time — WebSocket auth, hub, ack, reconnect + sync, dedupe
- [ ] M5 Production readiness — rate limiting, tests, HTTPS deploy, backups, portfolio link
