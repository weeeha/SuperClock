// App capability contract — structured metadata that is CHECKED against the
// tree, never trusted. Each kiosk app declares what it does (fetches, ticks,
// multiView) and what hardware it needs (audio, mic, radar) in
// src/shared/app-capabilities.ts. This gate holds the declarations to facts:
//   - fetches ⇔ the app directory calls fetch(); and a fetching app carries an
//     honest offline / not-configured tell (AGENTS.md Conventions);
//   - ticks ⇔ the directory owns a setInterval or requestAnimationFrame;
//   - multiView ⇔ the directory registers setVerticalSwipeCallback;
//   - every hardware capability is a device FeatureFlag that at least one
//     fleet device provides (capabilities.ts), so a designed "no speaker" chip
//     or "no mic on this device" tell has a flag to read;
//   - the wire descriptor (buildCapabilities) carries the same list.
// Lineage: Minimal-Design-System's capability contract (a component declares
// capabilities, each obliges demonstrable states), retargeted from stories to
// kiosk apps. 2026-08-15 audit: capability gating was "inconsistent AND
// unbacked" — no audio/mic/radar flags existed and every device declared the
// same features. This is the code half of that fix; UI gating is a follow-up.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { APP_CAPABILITIES, HARDWARE_CAPABILITIES, type AppCapability } from './app-capabilities';
import { buildCapabilities, devicesProviding, STATIC_DEVICE_INFO } from './capabilities';
import { ALL_DEVICE_IDS } from './types';

function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourcesUnder(full));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

function dirMatches(id: string, re: RegExp): boolean {
  return sourcesUnder(`src/apps/${id}`).some((f) => re.test(readFileSync(f, 'utf8')));
}

const FETCH = /\bfetch\(/;
const TIMER = /setInterval\(|requestAnimationFrame\(/;
const MULTI_VIEW = /setVerticalSwipeCallback\(/;
const HONEST_TELL = /offline|stale|not configured|not connected|unavailable|auth expired|no data/i;

const kioskAppIds = buildCapabilities('superclock-fast').apps.map((a) => a.id);

describe('app capabilities: coverage', () => {
  it('declares every kiosk app and nothing else', () => {
    expect(Object.keys(APP_CAPABILITIES).sort()).toEqual([...kioskAppIds].sort());
  });

  it('never repeats a capability within one app', () => {
    for (const [id, caps] of Object.entries(APP_CAPABILITIES)) {
      expect(new Set(caps).size, `${id} repeats a capability`).toBe(caps.length);
    }
  });
});

describe('app capabilities: declarations match the code', () => {
  const has = (id: string, cap: AppCapability) => APP_CAPABILITIES[id].includes(cap);

  it.each(kioskAppIds)('%s: fetches ⇔ the directory calls fetch()', (id) => {
    expect(has(id, 'fetches'), `${id}: fetch() in code is ${dirMatches(id, FETCH)}`).toBe(
      dirMatches(id, FETCH),
    );
  });

  it.each(kioskAppIds)('%s: ticks ⇔ the directory owns a timer or rAF loop', (id) => {
    expect(has(id, 'ticks'), `${id}: timer in code is ${dirMatches(id, TIMER)}`).toBe(
      dirMatches(id, TIMER),
    );
  });

  it.each(kioskAppIds)('%s: multiView ⇔ the directory registers the swipe slot', (id) => {
    expect(has(id, 'multiView'), `${id}: swipe registration in code is ${dirMatches(id, MULTI_VIEW)}`).toBe(
      dirMatches(id, MULTI_VIEW),
    );
  });

  it.each(kioskAppIds.filter((id) => APP_CAPABILITIES[id].includes('fetches')))(
    '%s fetches, so it carries an honest offline or not-configured tell',
    (id) => {
      expect(dirMatches(id, HONEST_TELL), `${id} fetches but no tell wording found under src/apps/${id}`).toBe(true);
    },
  );
});

describe('app capabilities: hardware needs are backed by device flags', () => {
  it('every hardware capability is provided by at least one fleet device', () => {
    for (const cap of HARDWARE_CAPABILITIES) {
      expect(devicesProviding(cap).length, `no device provides '${cap}'`).toBeGreaterThan(0);
    }
  });

  it('a device provides a hardware flag only if it is in the fleet', () => {
    for (const cap of HARDWARE_CAPABILITIES) {
      for (const d of devicesProviding(cap)) expect(ALL_DEVICE_IDS).toContain(d);
    }
  });

  it('the LVGL device declares no kiosk hardware (it runs the clock only)', () => {
    for (const cap of HARDWARE_CAPABILITIES) {
      expect(STATIC_DEVICE_INFO['superclock-slow'].features).not.toContain(cap);
    }
  });
});

describe('app capabilities: on the wire', () => {
  it('every device descriptor carries each app’s capability list', () => {
    for (const id of ALL_DEVICE_IDS) {
      for (const app of buildCapabilities(id).apps) {
        expect(app.capabilities, `${id}/${app.id} descriptor lacks capabilities`).toEqual(
          APP_CAPABILITIES[app.id],
        );
      }
    }
  });
});
