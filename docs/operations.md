# Operations Runbook

How to deploy, update, back up, restore and troubleshoot Personal Messenger on the VPS at `chat.rahmattomy.com`. The design is described in [ADR 0007](adr/0007-single-image-behind-host-nginx.md).

## Architecture in production

```
Internet ──443──► nginx (host, certbot TLS) ──► 127.0.0.1:8080 ──► app container ──► db container
                  chat.rahmattomy.com             (loopback only)    Go API + SPA      PostgreSQL, no port
```

- **Image:** `ghcr.io/tosrv/personal-messenger`, built and pushed by GitHub Actions after the tests pass.
- **On the VPS:** only `/opt/personal-messenger/` with `compose.yaml`, `.env`, `backup.sh`, `restore.sh` and `backups/`. No source code.
- **Logs** are rotated at 10 MB × 5 files per container.

All commands below run in `/opt/personal-messenger`.

## 1. First deployment

**Prerequisites:** Docker Engine with the Compose plugin, nginx and certbot (already on the VPS), and a DNS `A` record for `chat.rahmattomy.com` pointing at the VPS.

### 1.1 Publish the image

Push to `main` on GitHub. The **CI** workflow tests everything, then publishes `ghcr.io/tosrv/personal-messenger:latest`.

The first time, make the package public so the VPS can pull without logging in: *GitHub → your profile → Packages → personal-messenger → Package settings → Change visibility → Public*. The image contains no secrets; they live only in `.env` on the VPS.

To keep it private instead, log in once on the VPS with a [personal access token](https://github.com/settings/tokens) that has only `read:packages`:

```sh
echo <token> | docker login ghcr.io -u tosrv --password-stdin
```

### 1.2 Google OAuth

In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add to the OAuth client:

- Authorized JavaScript origin: `https://chat.rahmattomy.com`
- Authorized redirect URI: `https://chat.rahmattomy.com/api/v1/auth/callback`

Then publish the consent screen (*OAuth consent screen → Publish app*). In "Testing" mode only listed test users can sign in.

### 1.3 Files on the VPS

```sh
sudo mkdir -p /opt/personal-messenger && sudo chown "$USER" /opt/personal-messenger
cd /opt/personal-messenger
base=https://raw.githubusercontent.com/tosrv/personal-messenger/main/infra
curl -fsSLo compose.yaml "$base/compose.prod.yaml"
curl -fsSLO "$base/scripts/backup.sh"
curl -fsSLO "$base/scripts/restore.sh"
touch .env && chmod 600 .env
```

Write `.env`:

```sh
DOMAIN=chat.rahmattomy.com
IMAGE_TAG=latest              # or pin a release, e.g. 1.0.0
APP_PORT=8080                 # loopback port nginx proxies to; change if 8080 is taken
POSTGRES_PASSWORD=<openssl rand -hex 24>
SESSION_SECRET=<openssl rand -base64 48>
GOOGLE_CLIENT_ID=<from 1.2>
GOOGLE_CLIENT_SECRET=<from 1.2>
OWNER_USERNAME=<your username>   # guest mode: visitors without Google may chat with you; empty = off
```

Set `OWNER_USERNAME` after step 1.6, once you have chosen your username, then run `docker compose up -d` again.

Everything else (`APP_ENV`, `DATABASE_URL`, `ALLOWED_ORIGINS`, `GOOGLE_REDIRECT_URL`, `TRUSTED_PROXIES`) is derived in `compose.yaml`.

### 1.4 Start the app

```sh
docker compose pull
docker compose up -d
docker compose ps                         # app "running", db "healthy"
curl -s http://127.0.0.1:8080/api/v1/health
docker compose logs app | grep '"server listening"'   # shows the version
```

### 1.5 nginx and certificate

1. Get a certificate for the subdomain. If `rahmattomy.com` already has a wildcard certificate (`*.rahmattomy.com`), skip this step and point `ssl_certificate` at it instead.

   ```sh
   sudo certbot certonly --nginx -d chat.rahmattomy.com
   ```

2. Install the site config from the repository:

   ```sh
   sudo curl -fsSLo /etc/nginx/sites-available/chat.rahmattomy.com \
     https://raw.githubusercontent.com/tosrv/personal-messenger/main/infra/nginx/chat.rahmattomy.com.conf
   sudo ln -s /etc/nginx/sites-available/chat.rahmattomy.com /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

   If you changed `APP_PORT`, change `server 127.0.0.1:8080;` in the `upstream` block to match.

   The file uses `http2 on;`, which needs nginx 1.25.1 or newer. On older nginx, remove that line and write `listen 443 ssl http2;` instead.

3. Check it:

   ```sh
   curl -sI https://chat.rahmattomy.com | head -1      # HTTP/2 200
   curl -s https://chat.rahmattomy.com/api/v1/health    # {"status":"ok"}
   ```

### 1.6 Finish

1. Sign in at `https://chat.rahmattomy.com`, open `/settings` and choose your username, for example `tomy`.
2. Schedule backups ([section 3](#3-backups)).
3. Link the portfolio ([section 7](#7-portfolio-link)).

## 2. Updating and rolling back

Every push to `main` publishes a new `latest`. To deploy it:

```sh
docker compose pull && docker compose up -d
docker image prune -f        # remove the previous image
```

Database migrations run automatically when the app starts. Open WebSocket connections drop for a moment; clients reconnect and catch up on their own ([realtime.md](realtime.md)).

**Pin a release.** Create a git tag `v1.0.0` and push it; CI publishes `1.0.0`. Set `IMAGE_TAG=1.0.0` in `.env`, then pull and restart.

**Roll back.** Set `IMAGE_TAG` to the previous release, or to `sha-<commit>` from the package page, then `docker compose up -d`.

A rollback does not undo database migrations. Before deploying a release that changes the schema, take a backup first (`sh backup.sh`).

## 3. Backups

`backup.sh` writes `backups/messenger-<UTC timestamp>.sql.gz`. It checks that the archive is complete and deletes backups older than 14 days (`RETENTION_DAYS`). The directory and files are only readable by the owner.

Schedule it daily with `crontab -e`:

```cron
15 3 * * * cd /opt/personal-messenger && sh backup.sh >> backups/backup.log 2>&1
```

Copy backups **off the server**, because a backup on the same disk does not survive losing the VPS. For example, with [rclone](https://rclone.org) to any object storage:

```cron
45 3 * * * rclone copy /opt/personal-messenger/backups remote:messenger-backups --include "*.sql.gz"
```

Backups contain all messages and email addresses. Store them encrypted, or in a private bucket with restricted access (PRD §8).

## 4. Restoring

```sh
sh restore.sh backups/messenger-20261020T031500Z.sql.gz
```

The script checks the archive, asks for confirmation (skip with `YES=1`), stops the app, replaces the database contents, and starts the app again.

Practise a restore every few months, and after changes to the schema or scripts. The scripts were last verified on 2026-10-20: messages were deleted, then fully restored, and the app came back healthy.

## 5. Monitoring and logs

| What | Command |
|---|---|
| Service status | `docker compose ps` |
| Liveness | `curl -s https://chat.rahmattomy.com/api/v1/health` |
| Readiness incl. database | `curl -s http://127.0.0.1:8080/readyz` |
| App logs (JSON) | `docker compose logs -f --tail 100 app` |
| Only errors | `docker compose logs app \| grep '"level":"ERROR"'` |
| One request | Read its `X-Request-ID` response header, then `docker compose logs app \| grep <id>` |
| nginx | `sudo tail -f /var/log/nginx/error.log` |
| Disk usage | `df -h; docker system df` |

Request logs contain method, route, status, latency, request ID and user ID. They never contain cookies, tokens, email addresses, message bodies or search terms.

An external uptime check (for example UptimeRobot) on `https://chat.rahmattomy.com/api/v1/health` will alert you when the site goes down.

## 6. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `502 Bad Gateway` | The app is not running or listens on another port. Check `docker compose ps`, `docker compose logs app`, and that `APP_PORT` matches the nginx `upstream`. |
| `docker compose pull` says "denied" | The package is private and the VPS is not logged in (see 1.1). |
| "Sign-in failed" after Google | The redirect URI in Google Console does not exactly match `https://chat.rahmattomy.com/api/v1/auth/callback`, or the consent screen is still in Testing. The real reason is in `docker compose logs app` (`oauth callback failed`). |
| App keeps restarting | Usually config: `docker compose logs app`. `SESSION_SECRET` must be at least 32 characters. |
| "Connection lost" banner never goes away | nginx is not passing the WebSocket upgrade. The `location = /ws` block must be present and nginx reloaded. Messages still arrive through the 15 s fallback poll. |
| Everyone gets `429` at once | Client IPs are not reaching the app, so all users share one limit. Make sure nginx sets `X-Forwarded-For` (it does in the provided config). |
| Disk full | `docker image prune -a`; check `backups/` retention. |

## 7. Portfolio link

Link the portfolio's **Chat with me** button to your profile:

```html
<a href="https://chat.rahmattomy.com/u/tomy">Chat with me</a>
```

Visitors who are not signed in see "Sign in to chat with @tomy", continue with Google, and land back on your profile, where **Message** opens the conversation (PRD Flow A). Only same-app paths are accepted as the return destination, so the link cannot be abused as an open redirect.

## 8. Security checklist

- [ ] `.env` has mode `600`.
- [ ] `POSTGRES_PASSWORD` and `SESSION_SECRET` are long random values.
- [ ] `docker compose ps` shows the app port as `127.0.0.1:8080->8080/tcp`, and no port for `db`.
- [ ] SSH uses keys only; password login is disabled.
- [ ] The firewall allows only 22, 80 and 443.
- [ ] Backups are copied off-server and access is restricted.
- [ ] OS security updates are enabled (for example `unattended-upgrades`).
