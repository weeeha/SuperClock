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
//    the platform isn't Linux. Successful probes are cached; failed probes
//    are retried on every schedule tick, because at boot the server races
//    labwc's session startup and the Wayland socket often appears seconds
//    AFTER we first look for it. Caching that first failure would silently
//    disable the sleep schedule until the next server restart.
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

import { exec, execFile } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { promisify } from 'node:util';
import type { DeviceConfig } from '../src/shared/types';
import { isWithinWindow } from '../src/shared/time-window';
import { getPresenceState, onPresenceTransition } from './radar/service';
import { DEFAULT_ABSENT_AFTER_MIN } from '../src/shared/radar';

// Shell (for `command -v` only) vs direct binary invocation — wlr-randr is
// always run via execFile so no argument ever passes through a shell.
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const LOG_PREFIX = '[display-adapter]';
// How often to re-evaluate the sleep schedule (independent of config pushes).
const SCHEDULE_TICK_MS = 30_000;
// Inside the sleep window a radar wake keeps the panel on this long after
// the last presence — short on purpose (it's the middle of the night).
const SLEEP_WAKE_LINGER_MS = 60_000;

type Support =
  | { ok: true; env: NodeJS.ProcessEnv }
  | { ok: false; reason: string };

// Capability probe result — cached only on success. Failures re-probe on the
// next tick (boot race: the Wayland socket may not exist yet; see header).
let supportCached: Support | undefined;
// Cached detected output name (e.g. "HDMI-A-1", "DSI-1"). Re-detected if null.
let cachedOutput: string | null = null;
// Last power state we actually pushed — drives change detection.
// null = unknown (fresh process): the first reconcile always asserts state,
// so a restart while the panel is off can't strand it dark until the next
// sleep/wake cycle.
let appliedPoweredOn: boolean | null = null;
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
    await execAsync(`command -v ${bin}`, { env, timeout: 4000 });
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

async function getSupport(): Promise<Support> {
  if (supportCached) return supportCached;
  const result = await probeSupport();
  if (result.ok) {
    supportCached = result;
    if (logged) {
      // We previously logged "disabled — …"; make the recovery visible.
      console.log(`${LOG_PREFIX} support now available — sleep schedule active`);
    }
  }
  return result;
}

// Parse the first connected output name out of `wlr-randr` output. Lines for
// an output start at column 0 with the connector name; modes/properties are
// indented. Example:
//   HDMI-A-1 "Waveshare ..."
//     Make: ...
async function detectOutput(env: NodeJS.ProcessEnv): Promise<string | null> {
  if (cachedOutput) return cachedOutput;
  try {
    const { stdout } = await execFileAsync('wlr-randr', [], { env, timeout: 5000 });
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
    // execFile: args go straight to the binary, no shell interpolation.
    await execFileAsync('wlr-randr', args, { env, timeout: 5000 });
    return true;
  } catch (err) {
    console.warn(`${LOG_PREFIX} wlr-randr ${args.join(' ')} failed: ${(err as Error).message}`);
    return false;
  }
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

    const wantPoweredOn = decidePower(config, new Date());

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

// Called once from server startup. Loads the persisted config, attempts a
// first reconcile, and starts the schedule evaluator UNCONDITIONALLY — even
// when the first probe fails. At boot the Wayland socket frequently appears
// after we do (systemd races labwc), so the evaluator keeps re-probing and
// the schedule comes alive as soon as the session exists. On genuinely
// unsupported hosts (Mac dev, the slow Pi) each tick is a cheap no-op.
// Resolves quickly; never throws.
export async function initDisplayAdapter(getConfig: () => Promise<DeviceConfig>): Promise<void> {
  try {
    latestConfig = await getConfig();
    await reconcile(latestConfig);

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
