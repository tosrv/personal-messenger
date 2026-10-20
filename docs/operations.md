# Operations Runbook

How to deploy, update, back up, restore and troubleshoot Personal Messenger on a single VPS. Run every command from the repository root on the server (for example `/opt/personal-messenger`).

For brevity, `$P` below means:

```sh
P="docker compose -f infra/compose.prod.yaml --env-file .env"
```

## Architecture in production

```
Internet ──443/80──► Caddy ─┬─ /api/*, /ws ─► server (Go)  ──► db (PostgreSQL, no public port)
         (HTTPS)            └─ /*          ─► web (nginx, static SPA)
```

Caddy gets and renews TLS certificates automatically. Only ports 80 and 443 are exposed. Logs are rotated at 10 MB × 5 files per container.

## 1. First deployment

**Prerequisites:** a Linux VPS with Docker Engine and the Compose plugin, a domain, and ports 80 and 443 open in the firewall.

1. **DNS:** create an `A` record (and `AAAA` for IPv6) for your domain, for example `chat.example.com`, pointing at the VPS.

2. **Google OAuth:** in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add to your OAuth client:
   - Authorized JavaScript origin: `https://chat.example.com`
   - Authorized redirect URI: `https://chat.example.com/api/v1/auth/callback`

   Also publish the consent screen (*OAuth consent screen → Publish app*). In "Testing" mode only listed test users can sign in.

3. **Code and configuration:**

   ```sh
   git clone https://github.com/tosrv/personal-messenger.git /opt/personal-messenger
   cd /opt/personal-messenger
   cp .env.example .env
   chmod 600 .env
   ```

   Edit `.env`:

   | Variable | Value |
   |---|---|
   | `DOMAIN` | `chat.example.com` |
   | `POSTGRES_PASSWORD` | output of `openssl rand -hex 24` |
   | `SESSION_SECRET` | output of `openssl rand -base64 48` |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | from step 2 |

   `APP_ENV`, `DATABASE_URL`, `ALLOWED_ORIGINS`, `GOOGLE_REDIRECT_URL` and `TRUSTED_PROXIES` are set by `infra/compose.prod.yaml`, so the values in `.env` are ignored.

4. **Start:**

   ```sh
   $P up -d --build
   $P ps                                       # all services "running"/"healthy"
   curl -s https://chat.example.com/api/v1/health
   ```

5. **Sign in once** at `https://chat.example.com`, then open `/settings` and choose your username, for example `tomy`.

6. **Schedule backups** (see [section 3](#3-backups)).

## 2. Updating

```sh
git pull
$P up -d --build        # rebuilds changed images and restarts only what changed
$P logs -f --tail 50 server
```

Database migrations run automatically when the server starts. Open WebSocket connections drop during the restart; clients reconnect and resync on their own ([realtime.md](realtime.md)).

**Roll back** to the previous version:

```sh
git log --oneline -5
git checkout <previous-commit>
$P up -d --build
```

A rollback does not undo database migrations. Before deploying a migration that is hard to reverse, take a manual backup first (`sh infra/scripts/backup.sh`).

## 3. Backups

`infra/scripts/backup.sh` writes `backups/messenger-<UTC timestamp>.sql.gz`. It checks that the archive is complete and deletes backups older than 14 days (`RETENTION_DAYS`). The directory and files are only readable by the owner.

Schedule it daily with `crontab -e`:

```cron
15 3 * * * cd /opt/personal-messenger && sh infra/scripts/backup.sh >> backups/backup.log 2>&1
```

Copy backups **off the server**, because a backup on the same disk does not survive losing the VPS. For example, with [rclone](https://rclone.org) to any object storage:

```cron
45 3 * * * rclone copy /opt/personal-messenger/backups remote:messenger-backups --include "*.sql.gz"
```

Backups contain all messages and email addresses. Store them encrypted, or in a private bucket with restricted access (PRD §8).

## 4. Restoring

```sh
sh infra/scripts/restore.sh backups/messenger-20261020T031500Z.sql.gz
```

The script checks the archive, asks for confirmation (skip with `YES=1`), stops the server, replaces the database contents, and starts the server again.

**Practise a restore** every few months, and after changes to the schema or scripts. The script was last verified on 2026-10-20: messages were deleted, then fully restored, and the server came back healthy.

## 5. Monitoring and logs

| What | Command |
|---|---|
| Service status | `$P ps` |
| Liveness (public) | `curl -s https://<domain>/api/v1/health` |
| Readiness incl. database (internal only) | `$P exec caddy wget -qO- http://server:8080/readyz` |
| Server logs (JSON) | `$P logs -f --tail 100 server` |
| Only errors | `$P logs server \| grep '"level":"ERROR"'` |
| One request | Find its `X-Request-ID` response header, then `$P logs server \| grep <id>` |
| Disk usage | `df -h; docker system df` |

Request logs contain method, route, status, latency, request ID and user ID. They never contain cookies, tokens, email addresses, message bodies or search terms.

An external uptime check (for example UptimeRobot) on `https://<domain>/api/v1/health` will alert you when the site goes down.

## 6. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Browser shows a certificate error | DNS not pointing at the VPS yet, or port 80 blocked, so Caddy cannot get a certificate. Check `$P logs caddy`. |
| "Sign-in failed" after Google | Redirect URI in Google Console does not exactly match `https://<DOMAIN>/api/v1/auth/callback`, or the consent screen is still in Testing. The real reason is in `$P logs server` (`oauth callback failed`). |
| Server keeps restarting | Usually config: `$P logs server`. `SESSION_SECRET` must be at least 32 characters. |
| "Connection lost" banner never goes away | WebSockets blocked between the browser and Caddy, or the server is down. Messages still arrive through the 15 s fallback poll. |
| `429 too many requests` | Rate limit hit (see [ADR index](adr/README.md) and `rateRules` in `server/internal/httpapi/router.go`). Limits reset within a minute. |
| Disk full | `docker system prune` (removes unused images); check `backups/` retention. |

## 7. Portfolio link

Link your portfolio's **Chat with me** button to your profile:

```html
<a href="https://chat.example.com/u/tomy">Chat with me</a>
```

Visitors who are not signed in see "Sign in to chat with @tomy", continue with Google, and land back on your profile, where **Message** opens the conversation (PRD Flow A). Only same-app paths are accepted as the return destination, so the link cannot be abused as an open redirect.

## 8. Security checklist

- [ ] `.env` has mode `600` and is not in git.
- [ ] `POSTGRES_PASSWORD` and `SESSION_SECRET` are long random values, not the examples.
- [ ] The database has no published port (`$P ps` shows none for `db`).
- [ ] SSH uses keys only; password login is disabled.
- [ ] The firewall allows only 22, 80 and 443.
- [ ] Backups are copied off-server and access is restricted.
- [ ] OS security updates are enabled (for example `unattended-upgrades`).
