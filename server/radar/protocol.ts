// Line-oriented parser for the Waveshare A121 Range Sensor UART output.
//
// CALIBRATION PENDING: the Waveshare wiki documents a register command
// protocol for this module, but the exact frame layout could not be verified
// from this environment. The shipped demo firmware streams human-readable
// result lines (and some firmwares emit JSON), so this parser accepts both,
// generously. Until it is calibrated against real output, run the server
// with RADAR_DEBUG=1, capture a minute of raw lines from the log, and tighten
// the patterns below to match. Everything downstream (service, API, client)
// is independent of this file.

export interface RadarEvent {
  present?: boolean;
  distanceMm?: number;
  breathingRpm?: number;
  breathingConfidence?: number;
}

// Splits an incoming byte stream into lines, tolerating \r\n, \n and \r.
export class LineAccumulator {
  private buffer = '';

  push(chunk: Buffer | string): string[] {
    this.buffer += chunk.toString('utf8');
    // Guard against a binary-only firmware flooding the buffer with data
    // that never contains a newline.
    if (this.buffer.length > 16_384) {
      this.buffer = this.buffer.slice(-1024);
    }
    const parts = this.buffer.split(/\r\n|\n|\r/);
    this.buffer = parts.pop() ?? '';
    return parts.filter((l) => l.trim().length > 0);
  }
}

function toMm(value: number, unit: string | undefined): number {
  switch (unit?.toLowerCase()) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'm':
      return value * 1000;
    default:
      // Unitless: Acconeer tooling typically prints metres as small floats
      // ("0.52"), register dumps print millimetres as integers.
      return value < 20 ? value * 1000 : value;
  }
}

function fromJson(line: string): RadarEvent | null {
  if (!line.startsWith('{')) return null;
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    const event: RadarEvent = {};
    const presence = obj.presence ?? obj.present ?? obj.presence_detected;
    if (typeof presence === 'boolean') event.present = presence;
    if (typeof presence === 'number') event.present = presence !== 0;
    const distance = obj.distance_mm ?? obj.distance ?? obj.range;
    if (typeof distance === 'number') {
      event.distanceMm = typeof obj.distance_mm === 'number' ? distance : toMm(distance, undefined);
    }
    const rpm = obj.breathing_rate ?? obj.breath_rate ?? obj.rpm ?? obj.bpm;
    if (typeof rpm === 'number') event.breathingRpm = rpm;
    return Object.keys(event).length > 0 ? event : null;
  } catch {
    return null;
  }
}

const DISTANCE_RE = /dist(?:ance)?[^\d-]{0,12}(-?\d+(?:\.\d+)?)\s*(mm|cm|m)?\b/i;
const BREATH_RE = /(?:breath(?:ing)?(?:\s*rate)?|respirat\w*|rpm|bpm)[^\d-]{0,12}(\d+(?:\.\d+)?)/i;
const PRESENT_RE = /presence|motion|human|occupan/i;
const NEGATED_RE = /\b(no|not|none|false|0|lost|absent|off)\b/i;
const AFFIRMED_RE = /\b(detect\w*|true|1|yes|found|on)\b/i;

// Parses one output line into whatever radar facts it contains.
// Returns null for lines that carry no recognisable measurement.
export function parseRadarLine(line: string): RadarEvent | null {
  const json = fromJson(line.trim());
  if (json) return json;

  const event: RadarEvent = {};
  const distance = DISTANCE_RE.exec(line);
  if (distance) {
    const value = Number(distance[1]);
    if (Number.isFinite(value)) event.distanceMm = Math.round(toMm(value, distance[2]));
  }
  const breath = BREATH_RE.exec(line);
  if (breath) {
    const value = Number(breath[1]);
    // Plausibility gate — human respiration only.
    if (Number.isFinite(value) && value > 0 && value < 90) event.breathingRpm = value;
  }
  if (PRESENT_RE.test(line)) {
    if (NEGATED_RE.test(line)) event.present = false;
    else if (AFFIRMED_RE.test(line) || event.distanceMm !== undefined) event.present = true;
  }
  return Object.keys(event).length > 0 ? event : null;
}
