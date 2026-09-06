// Renders docs/health.md from the registries, the ledgers and the rule
// catalogue. It asserts nothing: the gates do that. Its job is to be a map an
// agent or a human reads in one screen, and a diff when something moves. Every
// list is sorted and nothing environmental (dates, hostnames, paths outside
// the repo) is written, so two renders of one tree are byte-identical and
// `npm test` can hold the committed copy to a fresh one.

import { basename } from 'node:path';
import { fileURLToPath } from 'node:url'; // never URL.pathname — this checkout path contains spaces
import { resolve } from 'node:path';
import { SCHEMAS } from '../../src/shared/schema-registry';
import { FACES } from '../../src/shared/face-registry';
import { APP_CAPABILITIES, HARDWARE_CAPABILITIES } from '../../src/shared/app-capabilities';
import { buildCapabilities, devicesProviding, STATIC_DEVICE_INFO } from '../../src/shared/capabilities';
import { ALL_DEVICE_IDS, type FeatureFlag } from '../../src/shared/types';
import { SCHEMA_UNREAD, faceFiles, isConsumed } from '../../src/shared/schema-liveness';
// @ts-expect-error — .mjs, deliberately untyped
import { FACE_TOKEN_EXEMPT } from './token-rules.mjs';
// @ts-expect-error — .mjs, deliberately untyped
import { loadRules, scan, walk } from '../rulecheck.mjs';
// @ts-expect-error — .mjs data module
import { BASELINE } from './rule-baseline.mjs';

export const HEALTH_REPORT_PATH = 'docs/health.md';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const short = (deviceId: string) => deviceId.replace(/^superclock-/, '');
const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);

interface Rule {
  id: string;
  title: string;
  severity: string;
  detect: { method: string; gate?: string; exempt?: { path: string; reason: string }[] };
}

function table(header: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

function appsSection(): string {
  const apps = [...buildCapabilities('superclock-fast').apps].sort(byId);
  const rows = apps.map((app) => {
    const caps = [...(APP_CAPABILITIES[app.id] ?? [])].sort();
    const hardware = caps.filter((c) => (HARDWARE_CAPABILITIES as readonly string[]).includes(c));
    const devices =
      hardware.length === 0
        ? 'any'
        : ALL_DEVICE_IDS.filter((d) => hardware.every((h) => devicesProviding(h as FeatureFlag).includes(d)))
            .map(short)
            .join(', ') || 'none';
    const schema = app.configSchemaId ?? (app.faces ? 'face-driven' : '—');
    const read = app.configSchemaId ? (isConsumed(app.configSchemaId) ? 'yes' : 'no') : '—';
    return [app.id, caps.join(', ') || '—', schema, read, devices];
  });
  return `## Apps (${apps.length})\n\n${table(['app', 'capabilities', 'config schema', 'schema read', 'devices with the hardware'], rows)}`;
}

function facesSection(): string {
  const files = faceFiles();
  const rows = [...FACES].sort(byId).map((face) => {
    const component = files[face.id] ? basename(files[face.id]) : '?';
    const night = (FACE_TOKEN_EXEMPT as string[]).includes(component) ? 'legacy (exempt)' : '--face-*';
    const read = face.configSchemaId ? (isConsumed(face.configSchemaId) ? 'yes' : 'no') : '—';
    return [face.id, face.category ?? '—', face.configSchemaId ?? '—', read, night, `${face.slots.length}`];
  });
  const exempt = [...(FACE_TOKEN_EXEMPT as string[])].sort();
  const ledger = `Ledger \`FACE_TOKEN_EXEMPT\` (${exempt.length}, shrink-only — a legacy face that never reads a \`--face-*\` token, so the night flip cannot reach it): ${exempt.map((f) => `\`${f}\``).join(', ') || 'empty'}.`;
  return `## Faces (${FACES.length})\n\n${table(['face', 'category', 'schema', 'schema read', 'night tokens', 'slots'], rows)}\n\n${ledger}`;
}

function schemasSection(): string {
  const ids = Object.keys(SCHEMAS).sort();
  const read = ids.filter((id) => isConsumed(id)).length;
  const kinds = ['app', 'face', 'complication'].map((k) => `${k}: ${ids.filter((id) => id.startsWith(`${k}.`)).length}`);
  const ledger = Object.entries(SCHEMA_UNREAD).sort(([a], [b]) => a.localeCompare(b));
  const ledgerText =
    ledger.length === 0
      ? 'Ledger `SCHEMA_UNREAD`: empty.'
      : `Ledger \`SCHEMA_UNREAD\` (${ledger.length}):\n\n${ledger.map(([id, why]) => `- \`${id}\`: ${why}`).join('\n')}`;
  return `## Schemas (${ids.length})\n\nRead by their owning component: ${read} of ${ids.length} (${kinds.join(', ')}).\n\n${ledgerText}\n\n${ids.map((id) => `- \`${id}\``).join('\n')}`;
}

function rulesSection(): string {
  const rules: Rule[] = [...loadRules(root)].sort(byId);
  const count = (pick: (r: Rule) => string) =>
    Object.entries(
      rules.reduce<Record<string, number>>((m, r) => ({ ...m, [pick(r)]: (m[pick(r)] ?? 0) + 1 }), {}),
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, n]) => `${k} ${n}`)
      .join(', ');
  const scopes: string[] = [...new Set(rules.flatMap((r) => (r.detect as { scope?: string[] }).scope ?? []))];
  const extensions: string[] = [...new Set(rules.flatMap((r) => (r.detect as { include?: string[] }).include ?? []))];
  const report = scan(rules, walk(root, scopes, extensions), root) as {
    violations: { id: string; severity: string; file: string; line: number }[];
    unchecked: { id: string; reason: string }[];
    delegated: { id: string; gate: string }[];
    summary: { blocker: number; review: number; warning: number; filesScanned: number };
  };
  const rows = rules.map((r) => [r.id, r.severity, r.detect.method, r.title]);
  const violations =
    report.violations.length === 0
      ? 'none'
      : report.violations.map((v) => `\`${v.id}\` ${v.file}:${v.line}`).sort().join(', ');
  const baseline = Object.entries(BASELINE as Record<string, number>).sort(([a], [b]) => a.localeCompare(b));
  const baselineText =
    baseline.length === 0 ? 'empty' : baseline.map(([k, n]) => `\`${k}\` ×${n}`).join(', ');
  const exemptions = rules
    .flatMap((r) => (r.detect.exempt ?? []).map((e) => `- \`${r.id}\` ${e.path}: ${e.reason}`))
    .sort();
  return [
    `## Rules (${rules.length}, rules/superclock.json)`,
    '',
    `By method: ${count((r) => r.detect.method)}. By severity: ${count((r) => r.severity)}.`,
    '',
    table(['id', 'severity', 'method', 'title'], rows),
    '',
    `Tree scan over ${report.summary.filesScanned} files: ${report.violations.length} violation(s) (${report.summary.blocker} blocker, ${report.summary.review} review, ${report.summary.warning} warning): ${violations}.`,
    '',
    `Baseline rows (\`BASELINE\`, frozen debt): ${baselineText}.`,
    '',
    `Unchecked on every run (needs a human or a browser): ${report.unchecked.map((u) => `\`${u.id}\` (${u.reason})`).sort().join(', ') || 'none'}.`,
    '',
    `Delegated to other gates: ${report.delegated.map((d) => `\`${d.id}\` → ${d.gate}`).sort().join(', ') || 'none'}.`,
    '',
    `Sanctioned exemptions (${exemptions.length}):`,
    '',
    exemptions.join('\n') || '- none',
  ].join('\n');
}

function devicesSection(): string {
  const rows = ALL_DEVICE_IDS.map((id) => {
    const info = STATIC_DEVICE_INFO[id];
    return [id, info.kind, info.readOnly ? 'yes' : 'no', [...info.features].sort().join(', '), `${info.supportedAppIds.length}`];
  });
  const hardware = HARDWARE_CAPABILITIES.map(
    (cap) => `- \`${cap}\`: ${devicesProviding(cap).map(short).join(', ') || 'no device'}`,
  );
  return `## Devices (${ALL_DEVICE_IDS.length})\n\n${table(['device', 'kind', 'read-only', 'features', 'apps offered'], rows)}\n\nHardware flags by device:\n\n${hardware.join('\n')}`;
}

export function renderHealthReport(): string {
  return [
    '# SuperClock health',
    '',
    'Generated by `npm run report` from the registries, the ledgers and the rule catalogue. Do not edit by hand: `npm test` fails when this file no longer matches a fresh render. It asserts nothing (the gates do that); read it as a map, and as a diff when it changes.',
    '',
    appsSection(),
    '',
    facesSection(),
    '',
    schemasSection(),
    '',
    rulesSection(),
    '',
    devicesSection(),
    '',
  ].join('\n');
}
