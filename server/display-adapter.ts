// On-device display adapter.
//
// Bridges persisted per-device settings (`settings.brightness`,
// `settings.sleepSchedule`) to the physical panel on a Raspberry Pi running
// labwc / wlroots, using the `wlr-randr` CLI.
// Night dimming is deliberately NOT handled here — it's a client-side CSS filter (src/core/apply-settings.ts); no released wlr-randr has a brightness flag.
//
// Design constraints (see PR for the full rationale):
//
//  - The same Express server also runs in local dev on a Mac and on the
//    "slow" Pi-Zero (native LVGL, no Wayland/Chromium). The adapter MUST
//    safely no-op — one info log, never throw, never block startup or a
//    request — when wlr-randr is missing, there is no Wayland session, or
//    the platform isn't Linux. Support is probed exactly once and cached.
//
//  - We only shell out when the *effective* brightness or power state
//    actually changes, never on the kiosk's 5s config poll. Callers may
//    invoke `applyDisplaySettings` as often as they like; it diffs against
//    the last-applied state and is otherwise a cheap no-op.
//
//  - `wlr-randr --brightness` DOES NOT EXIST in any released wlr-randr
//    (≤0.4.1 ships only --on/--off/--mode/--pos/--transform/--scale). The
//    day-brightness path below therefore fails on real hardware and always
//    has; it is kept pending the tracked follow-up (gamma daemon or removal).
//    Night dimming moved client-side — see the 2026-06-12 amendment in
//    docs/superpowers/specs/2026-06-12-night-mode-design.md.
//
//  - The "sleep" feature is a *schedule* (`{ wake, sleep }` HH:MM), not an
//    instantaneous toggle. We turn the output fully off (`--output X
//    --off`, which drops it to DPMS-off via wlroots) during the sleep
//    window and back on (`--on`) outside it. A 30s evaluator re-checks the
//    window so the panel sleeps/wakes at the scheduled times without any
//    further config change.

import { exec } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { promisify } from 'node:util';
import type { DeviceConfig } from '../src/shared/types';
import { isWithinWindow } from '../src/shared/time-window';
import { getPresenceState, onPresenceTransition } from './radar/service';
import { DEFAULT_ABSENT_AFTER_MIN } from '../src/shared/radar';

const execFileAsync = promisify(exec);

const LOG_PREFIX = '[display-adapter]';
// How often to re-evaluate the sleep schedule (independent of config pushes).
const SCHEDULE_TICK_MS = 30_000;
// Inside the sleep window a radar wake keeps the panel on this long after
// the last presence — short on purpose (it's the middle of the night).
const SLEEP_WAKE_LINGER_MS = 60_000;

type Support =
  | { ok: true; env: NodeJS.ProcessEnv }
  | { ok: false; reason: string };

interface AppliedState {
  // wlr-randr brightness multiplier last pushed (never succeeds on current hardware — see header), or null.
  brightness: number | null;
  // Whether the output is currently powered on (false = we issued --off).
  poweredOn: boolean;
}

// Cached one-shot capability probe. `undefined` = not probed yet.
let supportPromise: Promise<Support> | undefined;
// Cached detected output name (e.g. "HDMI-A-1", "DSI-1"). Re-detected if null.
let cachedOutput: string | null = null;
// Last state we actually pushed to the panel. Drives change detection.
const applied: AppliedState = { brightness: null, poweredOn: true };
// The most recent config we were handed — the schedule evaluator reads this.
let latestConfig: DeviceConfig | null = null;
let scheduleTimer: ReturnType<typeof setInterval> | null = null;
let logged = false;

function logOnce(message: string): void {
  if (logged) return;
  logged = true;
  console.log(`${LOG_PREFIX} ${message}`);
}

// Build the environment wlr-randr needs. Over an SSH-inherited / systemd
// context WAYLAND_DISPLAY and XDG_RUNTIME_DIR are frequently unset even
// though a Wayland session is running for the kiosk user. If we can see a
// wayland socket under the runtime dir, fall back to the conventional
// uid-1000 defaults rather than failing.
async function resolveWaylandEnv(): Promise<NodeJS.ProcessEnv | null> {
  const env = { ...process.env };

  if (env.WAYLAND_DISPLAY) {
    if (!env.XDG_RUNTIME_DIR) env.XDG_RUNTIME_DIR = '/run/user/1000';
    return env;
  }

  const runtimeDir = env.XDG_RUNTIME_DIR ?? '/run/user/1000';
  try {
    const entries = await readdir(runtimeDir);
    const sock = entries.find((e) => e === 'wayland-0' || /^wayland-\d+$/.test(e));
    if (!sock) return null;
    env.XDG_RUNTIME_DIR = runtimeDir;
    env.WAYLAND_DISPLAY = sock;
    return env;
  } catch {
    return null;
  }
}

async function onPath(bin: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  // PATH under systemd can be minimal; probe the usual install locations too.
  for (const dir of ['/usr/bin', '/usr/local/bin', '/bin']) {
    try {
      await access(`${dir}/${bin}`, FS.X_OK);
      return true;
    } catch {
      // keep looking
    }
  }
  try {
    await execFileAsync(`command -v ${bin}`, { env, timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}

async function probeSupport(): Promise<Support> {
  if (process.platform !== 'linux') {
    return { ok: false, reason: `platform ${process.platform} is not Linux` };
  }
  const env = await resolveWaylandEnv();
  if (!env) {
    return { ok: false, reason: 'no Wayland session (WAYLAND_DISPLAY unset, no socket found)' };
  }
  if (!(await onPath('wlr-randr', env))) {
    return { ok: false, reason: 'wlr-randr not found on PATH' };
  }
  return { ok: true, env };
}

function getSupport(): Promise<Support> {
  if (!supportPromise) supportPromise = probeSupport();
  return supportPromise;
}

// Parse the first connected output name out of `wlr-randr` output. Lines for
// an output start at column 0 with the connector name; modes/properties are
// indented. Example:
//   HDMI-A-1 "Waveshare ..."
//     Make: ...
async function detectOutput(env: NodeJS.ProcessEnv): Promise<string | null> {
  if (cachedOutput) return cachedOutput;
  try {
    const { stdout } = await execFileAsync('wlr-randr', { env, timeout: 5000 });
    for (const line of stdout.split('\n')) {
      if (!line || /^\s/.test(line)) continue; // skip blanks + indented props
      const name = line.split(/\s+/)[0]?.trim();
      if (name) {
        cachedOutput = name;
        return name;
      }
    }
  } catch {
    // fall through
  }
  return null;
}

async function runWlrRandr(args: string[], env: NodeJS.ProcessEnv): Promise<boolean> {
  try {
    // args are internally constructed (output name + numeric brightness),
    // never user free-text, but quote the output name defensively anyway.
    await execFileAsync(`wlr-randr ${args.join(' ')}`, { env, timeout: 5000 });
    return true;
  } catch (err) {
    console.warn(`${LOG_PREFIX} wlr-randr ${args.join(' ')} failed: ${(err as Error).message}`);
    return false;
  }
}

function clampBrightness(pct: number | undefined): number {
  // settings.brightness is an integer 0..100 from the admin UI. Map to the
  // 0.0..1.0 multiplier wlr-randr expects; default to full when unset.
  if (typeof pct !== 'number' || Number.isNaN(pct)) return 1;
  return Math.min(1, Math.max(0, pct / 100));
}

// Panel power decision. Baseline is the sleep schedule; when the A121 radar
// is delivering data (and settings.presence.enabled isn't false) presence
// takes over:
//   - outside the sleep window: stay on while present (or until absent for
//     absentAfterMin), so the panel blanks when nobody is around;
//   - inside the sleep window: normally off, but an approach wakes the panel
//     until SLEEP_WAKE_LINGER_MS after presence is lost.
function decidePower(config: DeviceConfig, now: Date): boolean {
  const { sleepSchedule, presence: presenceCfg } = config.settings;
  const inSleepWindow = isWithinWindow(
    sleepSchedule && { start: sleepSchedule.sleep, end: sleepSchedule.wake },
    now,
  );

  const radar = getPresenceState();
  if (!radar.available || presenceCfg?.enabled === false) return !inSleepWindow;

  const sinceSeenMs = now.getTime() - radar.lastSeenMs;
  if (inSleepWindow) {
    return radar.present === true || sinceSeenMs < SLEEP_WAKE_LINGER_MS;
  }
  const absentAfterMs =
    Math.max(1, presenceCfg?.absentAfterMin ?? DEFAULT_ABSENT_AFTER_MIN) * 60_000;
  // No verdict yet (present === null) keeps the panel on.
  return radar.present !== false || sinceSeenMs < absentAfterMs;
}

// Reconcile the panel with `config`. Cheap + idempotent: only issues a
// wlr-randr call when the effective brightness or power state changed.
// Never throws.
async function reconcile(config: DeviceConfig | null): Promise<void> {
  try {
    if (!config) return;
    const support = await getSupport();
    if (!support.ok) {
      logOnce(`disabled — ${support.reason}; brightness/sleep are no-ops on this host`);
      return;
    }
    const { env } = support;
    const output = await detectOutput(env);
    if (!output) {
      logOnce('no wlr-randr output detected; brightness/sleep are no-ops');
      return;
    }

    const { brightness } = config.settings;
    const now = new Date();
    const wantBrightness = clampBrightness(brightness);
    const wantPoweredOn = decidePower(config, now);

    // Power transitions first. While powered off there's no point pushing
    // brightness; we re-assert brightness on the next wake.
    if (wantPoweredOn !== applied.poweredOn) {
      const ok = await runWlrRandr(
        ['--output', output, wantPoweredOn ? '--on' : '--off'],
        env,
      );
      if (ok) {
        applied.poweredOn = wantPoweredOn;
        console.log(`${LOG_PREFIX} ${output} → ${wantPoweredOn ? 'on' : 'off (sleep)'}`);
        if (wantPoweredOn) {
          // Force brightness re-application after a wake.
          applied.brightness = null;
        }
      }
    }

    if (
      applied.poweredOn &&
      (applied.brightness === null ||
        Math.abs(applied.brightness - wantBrightness) > 0.001)
    ) {
      const ok = await runWlrRandr(
        ['--output', output, '--brightness', wantBrightness.toFixed(3)],
        env,
      );
      if (ok) {
        applied.brightness = wantBrightness;
        // Unreachable on released wlr-randr (no --brightness flag) — kept for a future gamma-capable tool.
        console.log(
          `${LOG_PREFIX} ${output} → brightness ${wantBrightness.toFixed(3)} ` +
            `(gamma multiplier, not backlight)`,
        );
      }
    }
  } catch (err) {
    // Defensive: reconcile must never reject (would surface as an unhandled
    // rejection from a fire-and-forget caller).
    console.warn(`${LOG_PREFIX} reconcile error (ignored): ${(err as Error).message}`);
  }
}

// Called from the fleet-store whenever THIS device's config changes
// (admin PATCH, device self-POST, etc.). Fire-and-forget.
export function applyDisplaySettings(config: DeviceConfig): void {
  latestConfig = config;
  void reconcile(config);
}

// Called once from server startup. Probes support (logging the no-op reason
// if unsupported), applies the current persisted config, and starts the
// schedule evaluator so the panel sleeps/wakes on time without further
// config pushes. Resolves quickly; never throws.
export async function initDisplayAdapter(getConfig: () => Promise<DeviceConfig>): Promise<void> {
  try {
    const support = await getSupport();
    if (!support.ok) {
      logOnce(`disabled — ${support.reason}; brightness/sleep are no-ops on this host`);
      return;
    }
    const config = await getConfig();
    latestConfig = config;
    await reconcile(config);

    if (scheduleTimer === null) {
      scheduleTimer = setInterval(() => {
        void reconcile(latestConfig);
      }, SCHEDULE_TICK_MS);
      // Don't keep the event loop alive solely for this timer.
      scheduleTimer.unref?.();
    }

    // Re-reconcile immediately on presence flips so a radar wake doesn't
    // wait for the next schedule tick.
    onPresenceTransition(() => {
      void reconcile(latestConfig);
    });
  } catch (err) {
    console.warn(`${LOG_PREFIX} init error (ignored): ${(err as Error).message}`);
  }
}

// Test/teardown helper — stops the schedule evaluator.
export function stopDisplayAdapter(): void {
  if (scheduleTimer !== null) {
    clearInterval(scheduleTimer);
    scheduleTimer = null;
  }
}
