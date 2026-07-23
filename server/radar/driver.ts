// Radar drivers: the exploration-sidecar bridge for the real A121 module, and a
// mock that synthesizes plausible data for development.
//
// The A121's exploration-server firmware streams raw radar data; the presence
// and breathing DSP runs in a Python sidecar (scripts/a121_sidecar.py, built on
// acconeer-exptool). This driver owns that child process: it parses its JSON
// stdout into RadarEvents and switches modes by RESTARTING it in the new mode —
// switching detectors in-process desyncs the exploration stream, whereas a
// fresh single-mode process reconnects reliably. Mirrors the display-adapter
// philosophy: never throw, never block startup, log once and retry quietly.

import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import type { RadarMode } from '../../src/shared/radar';
import { LineAccumulator, parseSidecarLine, type RadarEvent } from './protocol';

const LOG_PREFIX = '[radar]';
const RESTART_MS = 5_000;

export type RadarEventHandler = (event: RadarEvent) => void;
export type RadarStatusHandler = (connected: boolean) => void;

export interface RadarDriver {
  readonly source: 'sensor' | 'mock';
  start(onEvent: RadarEventHandler, onStatus: RadarStatusHandler): void;
  stop(): void;
  setMode(mode: RadarMode): void;
}

// ---------------------------------------------------------------------------
// Exploration sidecar driver
// ---------------------------------------------------------------------------

// The venv python + sidecar script. On the Pi these come from
// /etc/default/superclock (RADAR_PYTHON points at the exptool venv); in dev they
// fall back to python3 and the repo script path.
function sidecarPython(): string {
  return process.env.RADAR_PYTHON || 'python3';
}
function sidecarScript(): string {
  return process.env.RADAR_SIDECAR || resolve(process.cwd(), 'scripts/a121_sidecar.py');
}

export class ExplorationSidecarDriver implements RadarDriver {
  readonly source = 'sensor' as const;

  private child: ChildProcess | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private restartPending = false;
  private mode: RadarMode = 'presence';
  // True while the sidecar is crash-looping, so we log the degraded state once
  // instead of two lines every RESTART_MS forever (mirrors display-adapter).
  private loggedDegraded = false;
  private onEvent: RadarEventHandler = () => {};
  private onStatus: RadarStatusHandler = () => {};
  private readonly debug = process.env.RADAR_DEBUG === '1';

  start(onEvent: RadarEventHandler, onStatus: RadarStatusHandler): void {
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.stopped = false;
    this.spawnSidecar();
  }

  stop(): void {
    this.stopped = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    this.killChild();
  }

  setMode(mode: RadarMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (this.stopped) return;
    // Restart in the new mode. If a child is running, ask it to exit and let the
    // exit handler spawn the replacement — so the old process releases the
    // serial port before the new one opens it.
    if (this.child) {
      this.restartPending = true;
      this.killChild();
    } else {
      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
        this.restartTimer = null;
      }
      this.spawnSidecar();
    }
  }

  private killChild(): void {
    const child = this.child;
    if (!child) return;
    try {
      child.kill('SIGTERM');
    } catch {
      // already gone
    }
  }

  private scheduleRestart(): void {
    if (this.stopped || this.restartTimer) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.spawnSidecar();
    }, RESTART_MS);
    this.restartTimer.unref?.();
  }

  private spawnSidecar(): void {
    if (this.stopped) return;
    const python = sidecarPython();
    const script = sidecarScript();

    let child: ChildProcess;
    try {
      child = spawn(python, [script], {
        env: { ...process.env, RADAR_START_MODE: this.mode },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      console.warn(`${LOG_PREFIX} failed to spawn sidecar: ${(err as Error).message}`);
      this.onStatus(false);
      this.scheduleRestart();
      return;
    }

    this.child = child;
    // Quiet during a crash-loop; the recovery is logged once on the next 'ready'.
    if (!this.loggedDegraded) {
      console.log(`${LOG_PREFIX} sidecar started (${this.mode}) — ${python} ${script}`);
    }

    const lines = new LineAccumulator();
    child.stdout?.on('data', (chunk: Buffer) => {
      for (const line of lines.push(chunk)) this.handleLine(line);
    });
    // The sidecar logs diagnostics to stderr; surface them only in debug mode.
    child.stderr?.on('data', (chunk: Buffer) => {
      if (this.debug) process.stderr.write(chunk);
    });

    // A spawn-level failure (e.g. a bad RADAR_PYTHON path → async ENOENT, which
    // `spawn` does NOT throw synchronously) surfaces as 'error'. Node still
    // emits 'close' afterwards, so the retry is driven from 'close' below — the
    // one handler that fires for BOTH spawn failures and normal exits. Handling
    // only 'exit' would leave a bad-interpreter config permanently wedged.
    child.on('error', (err) => {
      if (this.child !== child) return;
      console.warn(`${LOG_PREFIX} sidecar spawn error: ${err.message}`);
    });

    child.on('close', (code, signal) => {
      if (this.child !== child) return;
      this.child = null;
      this.onStatus(false);
      if (this.stopped) return;
      if (this.restartPending) {
        this.restartPending = false;
        this.spawnSidecar();
        return;
      }
      if (!this.loggedDegraded) {
        this.loggedDegraded = true;
        console.warn(
          `${LOG_PREFIX} sidecar exited (code=${code} signal=${signal}) — retrying every ${RESTART_MS / 1000}s until it recovers`,
        );
      }
      this.scheduleRestart();
    });
  }

  private handleLine(line: string): void {
    const msg = parseSidecarLine(line);
    switch (msg.kind) {
      case 'ready':
        if (this.loggedDegraded) {
          console.log(`${LOG_PREFIX} sidecar recovered (${msg.mode})`);
          this.loggedDegraded = false;
        }
        this.onStatus(true);
        break;
      case 'event':
        this.onEvent(msg.event);
        break;
      case 'error':
        console.warn(`${LOG_PREFIX} sidecar: ${msg.message}`);
        break;
      case 'other':
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Mock driver
// ---------------------------------------------------------------------------

// Simulates someone at a desk: long stretches of presence with wandering
// distance, short absences, and a slow-breathing sinusoid in breathing mode.
export class MockRadarDriver implements RadarDriver {
  readonly source = 'mock' as const;

  private timer: ReturnType<typeof setInterval> | null = null;
  private mode: RadarMode = 'presence';
  private startedAt = 0;

  start(onEvent: RadarEventHandler, onStatus: RadarStatusHandler): void {
    this.startedAt = Date.now();
    onStatus(true);
    console.log(`${LOG_PREFIX} mock driver active (RADAR_MOCK) — synthesizing data`);
    this.timer = setInterval(() => {
      const t = (Date.now() - this.startedAt) / 1000;
      // 115s cycle: present for 90s, away for 25s.
      const present = t % 115 < 90;
      const event: RadarEvent = { present };
      if (present) {
        event.distanceMm = Math.round(650 + 180 * Math.sin(t / 9) + 25 * Math.sin(t * 1.7));
        if (this.mode === 'breathing') {
          event.breathingRpm = Math.round((13 + 2.5 * Math.sin(t / 47)) * 10) / 10;
          event.breathingConfidence = 0.9;
        }
      }
      onEvent(event);
    }, 500);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setMode(mode: RadarMode): void {
    this.mode = mode;
  }
}
