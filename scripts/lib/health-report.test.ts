// The regenerable health report (docs/health.md). Emitted from the registries,
// ledgers and the rule catalogue so divergence shows up as a DIFF; it asserts
// nothing about the system (the gates do that). This test keeps the committed
// copy honest: `npm run report` (REPORT_EMIT=1) rewrites it, and a plain
// `npm test` fails when the file no longer matches a fresh render, so nobody
// reads a stale map. Lineage: design-system-rebuild index/analysis.md ("emitted
// so that divergence BETWEEN components shows up as a diff. It asserts nothing").

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; // never URL.pathname — this checkout path contains spaces
import { resolve } from 'node:path';
import { renderHealthReport, HEALTH_REPORT_PATH } from './health-report';
import { SCHEMAS } from '../../src/shared/schema-registry';
import { buildCapabilities } from '../../src/shared/capabilities';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const target = resolve(root, HEALTH_REPORT_PATH);
const fresh = renderHealthReport();

if (process.env.REPORT_EMIT === '1') {
  writeFileSync(target, fresh);
}

describe('health report (docs/health.md)', () => {
  it('is committed and matches a fresh render (stale → run `npm run report`)', () => {
    expect(existsSync(target), `${HEALTH_REPORT_PATH} is missing — run npm run report`).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe(fresh);
  });

  it('renders deterministically (two renders are byte-identical)', () => {
    expect(renderHealthReport()).toBe(fresh);
  });

  it('names every registered app and every schema', () => {
    for (const app of buildCapabilities('superclock-fast').apps) {
      expect(fresh, `report lacks app ${app.id}`).toContain(`| ${app.id} |`);
    }
    for (const id of Object.keys(SCHEMAS)) {
      expect(fresh, `report lacks schema ${id}`).toContain(id);
    }
  });

  it('states the ledgers, the unchecked rules and the device flags', () => {
    expect(fresh).toContain('SCHEMA_UNREAD');
    expect(fresh).toContain('BASELINE');
    expect(fresh).toContain('FACE_TOKEN_EXEMPT');
    expect(fresh).toMatch(/FCE-1/);
    expect(fresh).toContain('superclock-fast');
    expect(fresh).toContain('Do not edit by hand');
  });
});
