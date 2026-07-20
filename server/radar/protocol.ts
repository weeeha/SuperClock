// Parser for the JSON line stream emitted by the A121 exploration sidecar
// (scripts/a121_sidecar.py). The sidecar runs Acconeer's presence/breathing DSP
// against the module's exploration-server firmware and prints one JSON object
// per line; this turns those lines into RadarEvents and lifecycle signals.
// Everything downstream (service, API, client) is independent of this file.

export interface RadarEvent {
  present?: boolean;
  distanceMm?: number;
  breathingRpm?: number;
  breathingConfidence?: number;
}

// A parsed sidecar line: a radar measurement, a lifecycle signal, or noise.
export type SidecarMessage =
  | { kind: 'event'; event: RadarEvent }
  | { kind: 'ready'; mode: 'presence' | 'breathing' }
  | { kind: 'error'; message: string }
  | { kind: 'other' };

// Splits an incoming byte stream into complete lines, tolerating \r\n, \n and
// \r. Sidecar lines are short JSON, so the buffer never grows large; the cap is
// only a guard against a wedged child emitting an endless newline-free stream.
export class LineAccumulator {
  private buffer = '';

  push(chunk: Buffer | string): string[] {
    this.buffer += chunk.toString('utf8');
    if (this.buffer.length > 16_384) {
      this.buffer = this.buffer.slice(-1024);
    }
    const parts = this.buffer.split(/\r\n|\n|\r/);
    this.buffer = parts.pop() ?? '';
    return parts.filter((l) => l.trim().length > 0);
  }
}

// Parses one sidecar line. Unrecognised or malformed lines are 'other' (the
// sidecar only ever writes JSON to stdout, but tolerate stray output).
export function parseSidecarLine(line: string): SidecarMessage {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return { kind: 'other' };
  }

  if (obj.status === 'ready') {
    return { kind: 'ready', mode: obj.mode === 'breathing' ? 'breathing' : 'presence' };
  }
  if (obj.status === 'error') {
    return {
      kind: 'error',
      message: typeof obj.message === 'string' ? obj.message : 'unknown error',
    };
  }

  // A measurement line. Null fields (e.g. distanceMm when absent) are typeof
  // 'object' and skipped, so we only carry through real numbers/booleans.
  const event: RadarEvent = {};
  if (typeof obj.present === 'boolean') event.present = obj.present;
  if (typeof obj.distanceMm === 'number') event.distanceMm = obj.distanceMm;
  if (typeof obj.breathingRpm === 'number') event.breathingRpm = obj.breathingRpm;
  if (typeof obj.breathingConfidence === 'number') {
    event.breathingConfidence = obj.breathingConfidence;
  }
  return Object.keys(event).length > 0 ? { kind: 'event', event } : { kind: 'other' };
}
