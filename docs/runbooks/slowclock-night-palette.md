# Runbook: deploy the night palette to slowclock (when it comes back online)

> **Status update 2026-08-07** (original written 2026-06-12, rescued from a stale
> worktree — preserved at tag `archive/slowclock-runbook`): PR #22 was CLOSED;
> the night palette merged into mainline `slow-native/` via **PR #24**
> (`split/night-palette`). Deploy from an up-to-date `main` checkout — the
> strange-bhaskara worktree no longer exists. slowclock has been offline since
> ~2026-06-09; everything below about process inspection, build, verification,
> and env overrides still applies.

Status at 2026-06-12: slowclock (Pi Zero 2 W) fully offline — no tailnet (last seen 3d ago),
no mDNS, no LAN ping to 192.168.4.59. If it pings but ssh fails → suspect host-key
change after reflash; fix: `ssh-keygen -R <addr>`.

## Steps when online

1. `ssh slowclock timedatectl` — confirm timezone (schedule 21:00–07:00 uses Pi-local time).
2. Inspect how the binary currently runs BEFORE touching it:
   `ps aux | grep superclock_native`; `ps -o pid,ppid,tty,args -p <pid>`;
   `systemctl is-enabled superclock-native 2>/dev/null` (unit exists in repo but was never
   enabled historically — binary runs standalone at ~/SuperClock-native/superclock_native).
   Record tty/parent so restart matches the original launch method.
3. Deploy. Preferred: `bash slow-native/scripts/deploy-from-mac.sh` run from an
   up-to-date main checkout (HOST defaults to `slowclock`; use `HOST=nickv2026@100.107.135.128`
   if mDNS flaky). BUT setup-pi.sh starts with `sudo apt-get` and nickv2026 has NO passwordless
   sudo → first test `ssh slowclock 'sudo -n true'`. If sudo prompts, do it manually
   (deps already installed from first native deploy):
   - rsync -az --delete --exclude build/ --exclude _build/ <worktree>/slow-native/ slowclock:SuperClock-native/slow-native/
   - ssh slowclock 'mkdir -p ~/SuperClock-native/build && cd ~/SuperClock-native/build && cmake -DCMAKE_BUILD_TYPE=Release ~/SuperClock-native/slow-native && cmake --build . --parallel $(nproc) && cp -v superclock_native ~/SuperClock-native/superclock_native'
   Build ≈2 min on the Zero 2 W. Do NOT run apt/systemd/raspi-config steps (need Nick's password).
4. Stop old process the way it runs (kill PID), start new binary the same way it was launched
   (likely from its tty/nohup — match what step 2 found).
5. Verify (binary has no night-state log lines, http_api is weather-only — so: clean start +
   no stderr + Nick's eyeball for visuals):
   - `SUPERCLOCK_NIGHT=always ./superclock_native` ~15s → expect black dial, white hands, gold second hand on the physical display; check no crash/stderr.
   - `SUPERCLOCK_NIGHT=never` ~15s → white dial, black hands.
   - Restart WITHOUT override for normal scheduled behavior (21:00–07:00).
6. PushNotification Nick with the outcome; ask him to glance at the display to confirm palette.
7. Update memory files (minimalismo.md / night_mode.md): deploy no longer pending.

Env override semantics (clock_face.c:210): SUPERCLOCK_NIGHT=always→1, never→-1, else schedule.
