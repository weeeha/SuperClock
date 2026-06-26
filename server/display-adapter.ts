// On-device display adapter.
//
// Bridges the persisted per-device sleep schedule (`settings.sleepSchedule`)
// to the physical panel on a Raspberry Pi running labwc / wlroots, using the
// `wlr-randr` CLI.
//
// Brightness — day (`settings.brightness`) and night (`settings.night`) — is
// deliberately NOT handled here: no released wlr-randr (≤0.4.1) has a
// --brightness flag, and these panels expose no backlight device. The kiosk
// dims its own rendering with a CSS brightness() filter instead
// (src/core/apply-settings.ts); see the 2026-06-12 amendments in
// docs/superpowers/specs/2026-06-12-night-mode-design.md.
//
// Design constraints (see PR for the full rationale):
//
//  - The same Express server also runs in local dev on a Mac and on the
//    "slow" Pi-Zero (native LVGL, no Wayland/Chromium). The adapter MUST
//    safely no-op — one info log, never throw, never block startup or a
//    request — when wlr-randr is missing, there is no Wayland session, or
//    the platform isn't Linux. Support is probed exactly once and cached.
//
//  - We only shell out when the effective power state actually changes,
//    never on the kiosk's 5s config poll. Callers may invoke
//    `applyDisplaySettings` as often as they like; it diffs against the
//    last-applied state and is otherwise a cheap no-op.
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

const execFileAsync = promisify(exec);

const LOG_PREFIX = '[display-adapter]';
// How often to re-evaluate the sleep schedule (independent of config pushes).
const SCHEDULE_TICK_MS = 30_000;

type Support =
  | { ok: true; env: NodeJS.ProcessEnv }
  | { ok: false; reason: string };

// Cached one-shot capability probe. `undefined` = not probed yet.
let supportPromise: Promise<Support> | undefined;
// Cached detected output name (e.g. "HDMI-A-1", "DSI-1"). Re-detected if null.
let cachedOutput: string | null = null;
// Whether the output is currently powered on (false = we issued --off).
// Last state we actually pushed — drives change detection.
let appliedPoweredOn = true;
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
    // args are internally constructed (output name + fixed flags), never
    // user free-text, but quote the output name defensively anyway.
    await execFileAsync(`wlr-randr ${args.join(' ')}`, { env, timeout: 5000 });
    return true;
  } catch (err) {
    console.warn(`${LOG_PREFIX} wlr-randr ${args.join(' ')} failed: ${(err as Error).message}`);
    return false;
  }
}

// Reconcile the panel with `config`. Cheap + idempotent: only issues a
// wlr-randr call when the desired power state changed. Never throws.
async function reconcile(config: DeviceConfig | null): Promise<void> {
  try {
    if (!config) return;
    const support = await getSupport();
    if (!support.ok) {
      logOnce(`disabled — ${support.reason}; sleep schedule is a no-op on this host`);
      return;
    }
    const { env } = support;
    const output = await detectOutput(env);
    if (!output) {
      logOnce('no wlr-randr output detected; sleep schedule is a no-op');
      return;
    }

    const { sleepSchedule } = config.settings;
    const wantPoweredOn = !isWithinWindow(
      sleepSchedule && { start: sleepSchedule.sleep, end: sleepSchedule.wake },
      new Date(),
    );

    if (wantPoweredOn !== appliedPoweredOn) {
      const ok = await runWlrRandr(
        ['--output', output, wantPoweredOn ? '--on' : '--off'],
        env,
      );
      if (ok) {
        appliedPoweredOn = wantPoweredOn;
        console.log(`${LOG_PREFIX} ${output} → ${wantPoweredOn ? 'on' : 'off (sleep)'}`);
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
      logOnce(`disabled — ${support.reason}; sleep schedule is a no-op on this host`);
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
