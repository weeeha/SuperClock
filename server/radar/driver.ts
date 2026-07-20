// Radar drivers: the serial transport for the real A121 module, and a mock
// that synthesizes plausible data for development.
//
// The serial driver is deliberately dependency-free: the module's CH342
// USB-serial chip enumerates as a plain tty, so we configure it with `stty`
// and stream it with node:fs — no native serialport bindings to build on the
// Pi. Mirrors the display-adapter philosophy: never throw, never block
// startup, log once and retry quietly.

import { createReadStream, type ReadStream } from 'node:fs';
import { access, readdir } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RadarMode } from '../../src/shared/radar';
import { LineAccumulator, parseRadarLine, type RadarEvent } from './protocol';

const execFileAsync = promisify(execFile);

const LOG_PREFIX = '[radar]';
const RETRY_MS = 5_000;
const DEFAULT_BAUD = 921_600;

export type RadarEventHandler = (event: RadarEvent) => void;
export type RadarStatusHandler = (connected: boolean) => void;

export interface RadarDriver {
  readonly source: 'sensor' | 'mock';
  start(onEvent: RadarEventHandler, onStatus: RadarStatusHandler): void;
  stop(): void;
  setMode(mode: RadarMode): void;
}

// ---------------------------------------------------------------------------
// Serial driver
// ---------------------------------------------------------------------------

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, FS.R_OK);
    return true;
  } catch {
    return false;
  }
}

// Candidate ports, best guess first. /dev/serial/by-id is stable across
// re-plugs; the CH342 shows up under QinHeng's USB vendor strings.
async function findPort(): Promise<string | null> {
  const explicit = process.env.RADAR_PORT;
  if (explicit) return (await exists(explicit)) ? explicit : null;

  try {
    const byId = await readdir('/dev/serial/by-id');
    const preferred =
      byId.find((e) => /ch34|qinheng|1a86/i.test(e)) ?? byId[0];
    if (preferred) return `/dev/serial/by-id/${preferred}`;
  } catch {
    // directory absent when no USB serial devices — fall through
  }

  for (const candidate of ['/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyUSB0', '/dev/ttyUSB1']) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

export class SerialRadarDriver implements RadarDriver {
  readonly source = 'sensor' as const;

  private stream: ReadStream | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private loggedWaiting = false;
  private onEvent: RadarEventHandler = () => {};
  private onStatus: RadarStatusHandler = () => {};
  private readonly debug = process.env.RADAR_DEBUG === '1';
  private readonly baud = parseInt(process.env.RADAR_BAUD || `${DEFAULT_BAUD}`, 10);

  start(onEvent: RadarEventHandler, onStatus: RadarStatusHandler): void {
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.stopped = false;
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.stream?.destroy();
    this.stream = null;
  }

  setMode(mode: RadarMode): void {
    // CALIBRATION PENDING: switching detector modes requires the register
    // command protocol (see protocol.ts header). Until it's calibrated the
    // module keeps streaming whatever its flashed firmware produces.
    console.log(`${LOG_PREFIX} mode '${mode}' requested — protocol calibration pending, no command sent`);
  }

  private scheduleRetry(): void {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, RETRY_MS);
    this.retryTimer.unref?.();
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const port = await findPort();
    if (!port) {
      if (!this.loggedWaiting) {
        this.loggedWaiting = true;
        console.log(`${LOG_PREFIX} no serial port found — waiting for the A121 module (set RADAR_PORT to override)`);
      }
      this.onStatus(false);
      this.scheduleRetry();
      return;
    }

    try {
      // raw mode: no line editing, no echo, binary-safe.
      await execFileAsync(
        'stty',
        ['-F', port, String(this.baud), 'raw', '-echo', '-echoe', '-echok'],
        { timeout: 4000 },
      );
    } catch (err) {
      console.warn(`${LOG_PREFIX} stty failed on ${port}: ${(err as Error).message}`);
      this.onStatus(false);
      this.scheduleRetry();
      return;
    }

    const lines = new LineAccumulator();
    const stream = createReadStream(port, { highWaterMark: 4096 });
    this.stream = stream;
    console.log(`${LOG_PREFIX} reading ${port} @ ${this.baud} baud`);
    this.loggedWaiting = false;
    this.onStatus(true);

    stream.on('data', (chunk) => {
      for (const line of lines.push(chunk as Buffer)) {
        if (this.debug) console.log(`${LOG_PREFIX} << ${line}`);
        const event = parseRadarLine(line);
        if (event) this.onEvent(event);
      }
    });
    const drop = (why: string) => {
      if (this.stream !== stream) return;
      this.stream = null;
      stream.destroy();
      if (!this.stopped) {
        console.warn(`${LOG_PREFIX} ${port} ${why} — retrying in ${RETRY_MS / 1000}s`);
        this.onStatus(false);
        this.scheduleRetry();
      }
    };
    stream.on('error', (err) => drop(`error: ${err.message}`));
    stream.on('close', () => drop('closed'));
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
