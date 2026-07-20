import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// fleet-store resolves its paths from process.cwd() at module load, so we
// chdir into a temp dir BEFORE importing it. Each test gets a fresh config/
// dir; the module instance (and its in-memory lock) is shared across tests,
// which matches production (one process, one store).
const workdir = await mkdtemp(join(tmpdir(), 'fleet-store-test-'));
process.chdir(workdir);

const store = await import('./fleet-store');
const CONFIG_DIR = join(workdir, 'config');
const FLEET_PATH = join(CONFIG_DIR, 'fleet.json');

beforeEach(async () => {
  await rm(CONFIG_DIR, { recursive: true, force: true });
  await mkdir(CONFIG_DIR, { recursive: true });
});

describe('readFleet', () => {
  it('returns the default fleet when no file exists', async () => {
    const fleet = await store.readFleet();
    expect(fleet.devices.map((d) => d.deviceId)).toContain('superclock-fast');
    expect(fleet.version).toBe(0);
  });

  it('quarantines corrupt JSON and falls back to defaults instead of throwing', async () => {
    await writeFile(FLEET_PATH, '{definitely not json', 'utf8');
    const fleet = await store.readFleet();
    expect(fleet.devices.length).toBeGreaterThan(0); // served, not thrown
    const files = await readdir(CONFIG_DIR);
    expect(files.some((f) => f.startsWith('fleet.json.corrupt-'))).toBe(true);
    expect(files.includes('fleet.json')).toBe(false); // moved aside
  });

  it('quarantines valid JSON with the wrong shape', async () => {
    await writeFile(FLEET_PATH, JSON.stringify({ devices: 'nope' }), 'utf8');
    const fleet = await store.readFleet();
    expect(Array.isArray(fleet.devices)).toBe(true);
    const files = await readdir(CONFIG_DIR);
    expect(files.some((f) => f.startsWith('fleet.json.corrupt-'))).toBe(true);
  });
});

describe('updateDevice', () => {
  it('upserts a device, stamps updatedAt, and bumps the fleet version', async () => {
    const before = await store.readFleet();
    const updated = await store.updateDevice('superclock-fast', (c) => ({
      ...c,
      enabledApps: ['clock'],
    }));
    expect(updated.enabledApps).toEqual(['clock']);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(0);

    const after = await store.readFleet();
    expect(after.version).toBe(before.version + 1);
    expect(
      after.devices.find((d) => d.deviceId === 'superclock-fast')?.enabledApps,
    ).toEqual(['clock']);
  });

  it('does not lose writes when two mutations overlap (read-modify-write race)', async () => {
    // Without full-cycle locking both calls read the same base snapshot and
    // the later write silently erases the earlier one.
    await Promise.all([
      store.updateDevice('superclock-fast', (c) => ({ ...c, enabledApps: ['clock'] })),
      store.updateDevice('superclock-small', (c) => ({
        ...c,
        settings: { ...c.settings, accent: '#123456' },
      })),
    ]);
    const fleet = await store.readFleet();
    const fast = fleet.devices.find((d) => d.deviceId === 'superclock-fast');
    const small = fleet.devices.find((d) => d.deviceId === 'superclock-small');
    expect(fast?.enabledApps).toEqual(['clock']);
    expect(small?.settings.accent).toBe('#123456');
    expect(fleet.version).toBe(2); // one bump per write, no double-increment
  });

  it('persists atomically — the written file is always parseable', async () => {
    await store.updateDevice('superclock-fast', (c) => c);
    const raw = await readFile(FLEET_PATH, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe('migrateFleet', () => {
  it('normalizes kiosk theme dark→system, strips brightness, stamps updatedAt', async () => {
    const stale = {
      devices: [
        {
          deviceId: 'superclock-fast',
          enabledApps: [],
          instances: [],
          playlist: { items: [], rotationSeconds: null },
          settings: { theme: 'dark', accent: '#fff', brightness: 80 },
          updatedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      version: 5,
    };
    await writeFile(FLEET_PATH, JSON.stringify(stale), 'utf8');

    await store.migrateFleet();

    const fleet = await store.readFleet();
    const fast = fleet.devices.find((d) => d.deviceId === 'superclock-fast')!;
    expect(fast.settings.theme).toBe('system');
    expect(fast.settings.brightness).toBeUndefined();
    // Polling kiosks key change-detection on updatedAt — migration MUST stamp it.
    expect(fast.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
    expect(fleet.schemaVersion).toBe(2);
  });

  it('is idempotent — a second run changes nothing', async () => {
    await store.migrateFleet();
    const first = await store.readFleet();
    await store.migrateFleet();
    const second = await store.readFleet();
    expect(second).toEqual(first);
  });
});
