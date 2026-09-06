---
paths:
  - "scripts/*.sh"
  - "scripts/*.service"
  - "slow-native/scripts/*"
  - ".github/workflows/*.yml"
summary: "**Pi deployment** — what `deploy.sh` ships, its guards and the live systemd naming drift live in `.claude/rules/pi-deployment.md` (loaded automatically when you touch a deploy or provisioning script). Never trust `dist/` mtimes; `/api/health` carries the build stamp."
---

# Pi deployment

Loaded when you touch a deploy, provisioning or CI script. The one-line rule
lives in AGENTS.md; this is the body.

`scripts/deploy.sh nickv2026@<pi-ip>` builds locally and rsyncs the runtime payload to `~/SuperClock` on the Pi: `dist/` (client + `server.mjs` + `build-info.json`), `package*.json`, `config/fleet.example.json`, `scripts/`. The server is a self-contained esbuild bundle, so there is **no list of server source dirs to maintain** — npm packages stay external and are installed on the Pi (`npm ci --omit=dev`). `config/fleet.json` and `config/admin.json` are device-local state, never synced. The deploy script restarts the server (systemd brings it back) so fleet migrations run immediately.

Deploys are **guarded and self-verifying**: the script refuses a dirty tree or a HEAD that isn't origin/main (`DEPLOY_ANYWAY=1` overrides — that's the blessed path for branch test builds on fastclock), refuses a device without 3× payload free space, and after restarting polls `/api/health` until the reported `build.commit` equals the commit it shipped — so "which commit is this device running?" is answered by `curl <pi>:3000/api/health`, never by `dist/` mtimes (rsync preserves them; they lie).

First-time provisioning uses `scripts/setup-pi.sh` (run as root on Pi OS Trixie): installs Node + npm via `apt-get`, runs `npm ci --omit=dev`, and installs **one** systemd unit — `superclock-server.service` (`ExecStart=npm run start`, `WorkingDirectory=~/SuperClock`). **Naming drift on the live fleet:** devices provisioned before that unit existed run the server as `superclock.service` (verified on fastclock 2026-08-07) — a fresh provision creates the new name, so use `systemctl status 'superclock*'` when inspecting; deploy.sh's pkill-based restart works for either. The Chromium kiosk is **not** a systemd service: `scripts/kiosk.sh` is wired into `~/.config/labwc/autostart`, waits for `/api/health`, and execs Chromium with the required Wayland flags. `setup-pi.sh` is idempotent; `SERVICE_USER`/`REPO_DIR`/`PORT`/`ADMIN_HOST` are env-overridable. Server-side secrets (`CALENDAR_ICS_URL`, `GITHUB_TOKEN`) go in `/etc/default/superclock` on the Pi or `.env` in dev.
