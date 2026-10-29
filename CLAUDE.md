# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Self-hosted real-time messenger: Google OIDC (plus optional guest mode), user search, 1-on-1 DMs, PostgreSQL persistence, WebSocket push. Go API in `server/`, React SPA in `web/`, deploy config in `infra/`. Scope lives in [docs/prd.md](docs/prd.md); design decisions in [docs/adr/](docs/adr/) — read the relevant ADR before changing auth, realtime, or deployment shape.

## Commands

```sh
cp .env.example .env && docker compose up --build   # full stack: web :5173, api :8080, postgres on host :5433
docker compose up db                                # db only, then run server/web natively:
cd server && go run ./cmd/api                       # migrations run automatically on startup
cd web && npm install && npm run dev
```

Server (from `server/`):
- `gofmt -l .` must be empty (CI enforces), `go vet ./...`, `go test ./...`
- Single test: `go test ./internal/message -run TestSend`
- Integration tests (repositories, sessions) are **skipped** unless `TEST_DATABASE_URL` is set. Create the DB once with `docker compose exec db psql -U messenger -c "CREATE DATABASE messenger_test"`, then:
  `TEST_DATABASE_URL=postgres://messenger:messenger@localhost:5433/messenger_test?sslmode=disable go test -p 1 ./...`
  (`-p 1` is required — packages share one database. CI also runs with `-race`.)

Web (from `web/`):
- `npm run check` = typecheck + oxlint + prettier check + vitest (what CI runs, followed by `npm run build`)
- Single test: `npx vitest run src/features/chat/ChatPanel.test.tsx` (or `-t "name"`)
- `npm run format` to fix prettier failures

Production image: `docker build -t personal-messenger .` (one image: Go API also serves the built SPA).

Vulnerability scan (not in CI): `cd server && go run golang.org/x/vuln/cmd/govulncheck@latest ./...`

## Working rules

- After every change, run tests, lint, type-check and build for **both** server and web (`go vet`, `go test`, `go build ./cmd/api`; `npm run check`, `npm run build`). Not done until all green.
- Never weaken, delete or skip tests to make the build pass.
- Migrations must be additive (new columns nullable or with a default). Never drop or rename columns/tables — real production data exists.
- New design decisions get a new ADR in `docs/adr/` **before** implementation (follow the existing numbering and format).
- Every new WebSocket event must be validated and rate-limited.
- Config goes through env vars; never commit secrets or `.env`.
- Don't touch credentials, VPS access, the deploy workflow, or push to `main` unless explicitly asked.
- On ambiguity: record the assumption in `NOTES.md` (repo root) and keep going instead of stopping to ask.
- One feature per branch/commit, with a descriptive commit message.

## Architecture

- **Single origin** (ADR 0002): SPA and API share an origin so the `pm_session` cookie is first-party (`SameSite=Lax`). In dev, Vite proxies `/api` and `/ws` to Go; in prod, host nginx proxies everything to the container, and Go serves the SPA via `internal/httpapi/spa.go`.
- **Sessions** (ADR 0001): opaque tokens stored hashed in Postgres, sliding 30-day expiry. CSRF protection is an Origin check (`internal/middleware/csrf.go`), also applied to WebSocket upgrades against `ALLOWED_ORIGINS`.
- **Send over REST, receive over WebSocket** (ADR 0006): `POST /api/v1/conversations/:id/messages` persists first, then `realtime` notifies every open connection of every member (including the sender's other tabs). Postgres is the source of truth (ADR 0003); WS is transport only. On reconnect the client receives `ready` and does a catch-up fetch. Protocol details: [docs/realtime.md](docs/realtime.md).
- **Idempotent sends**: messages carry a client-generated `client_message_id`, unique per sender; retries return the existing message.
- **Single backend instance** (ADR 0005): the WS hub and rate limiter are in-memory. Don't introduce designs that assume horizontal scaling without revisiting that ADR.
- **Server layout**: each domain package under `server/internal/` (`auth`, `user`, `conversation`, `message`, `realtime`) follows `handler → service → repository`. Routes and per-route rate limits (`rateRules`) are wired in `internal/httpapi/router.go`; dependencies are built in `cmd/api/main.go`. Errors flow through `internal/apperr`; HTTP helpers are in `internal/httpx`. Every conversation/message access checks membership server-side.
- **Migrations**: versioned SQL pairs in `server/migrations/` (`NNNNNN_name.up.sql` / `.down.sql`), applied by golang-migrate at startup. Schema notes: [docs/database.md](docs/database.md).
- **Guest mode** (ADR 0008): enabled when `OWNER_USERNAME` is set. Guests (`is_guest`, no Google sub/email, `guest_*` usernames) can only chat with the owner in both directions, can't search or be found, and are deleted by retention rules (7 days with no messages / 90 days inactive). `GET /api/v1/config` exposes guest mode and the owner to the SPA. Keep these restrictions when touching search, conversation creation, or users.
- **Web layout**: `src/features/<domain>/` holds `api.ts` (fetch + TanStack Query, ADR 0004) next to its pages and tests. `src/lib/api.ts` is the fetch wrapper, `src/lib/realtime.ts` the reconnecting WS client, and `features/realtime/RealtimeProvider.tsx` pushes WS events into the query cache. Shared UI primitives are in `src/components/ui` (Radix + Tailwind v4, shadcn-style via `components.json`).

## Deployment

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) publishes `ghcr.io/tosrv/personal-messenger` (`latest` on `main`, `X.Y.Z` on `vX.Y.Z` tags) after tests pass. The VPS runs only `infra/compose.prod.yaml` + `.env` behind host nginx/certbot for `chat.rahmattomy.com`. See [docs/operations.md](docs/operations.md) for deploy, rollback, backup/restore.
