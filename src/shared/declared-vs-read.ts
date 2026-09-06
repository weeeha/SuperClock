// Declared vs read: which config fields, tokens and slots each consumer
// actually uses, computed from source text. Pure (no fs): the runner
// scripts/analyze.ts and the gate scripts/lib/analyze.test.ts own the tree
// walk and the committed report at docs/analysis/declared-vs-read.md.
//
// Why this exists: registry-coherence and registry-contract prove the LISTS
// agree, so nothing is ever missing; they cannot prove a schema is ever READ,
// which is how the admin became "a remote control for a device that is mostly
// not listening" (docs/decisions/2026-07-24-concept-adjudications.md). This
// is the pivoted report the article-style `analyze` step produces, so neither
// a reviewer nor an agent has to re-derive it by hand.
//
// Heuristics, deliberately grep-level and documented in the report header:
// a field is "read" when its key appears as a whole-word identifier in the
// consumer's sources; the parse style keys off the registry's naming
// convention (<camelId><App|Face>Schema) so another schema's safeParse does
// not get credited.

import type { z } from 'zod';
import type { FaceDescriptor } from './types';

export interface SourceFile {
  path: string;
  text: string;
}

export interface AppInput {
  id: string;
  /** The default-export component (<Name>App.tsx), where the `config` prop lands. */
  componentPath: string;
  /** Every non-test .ts/.tsx under the app directory, component included. */
  sources: SourceFile[];
}

export interface AnalyzeInput {
  schemas: Record<string, { schema: z.ZodObject<z.ZodRawShape> }>;
  apps: AppInput[];
  faces: FaceDescriptor[];
  /** src/apps/clock/face-components.ts, parsed for the id -> component map. */
  faceComponentsSource: string;
  /** Component name -> source text of src/apps/clock/<Component>.tsx. */
  faceSources: Record<string, string>;
  /** FACE_TOKEN_EXEMPT from scripts/lib/token-rules.mjs (file names). */
  faceTokenExempt: readonly string[];
}

export type ParseStyle = 'safeParse' | 'parse' | 'cast' | 'raw' | 'none';

export interface AppReport {
  id: string;
  schemaId: string | null;
  parse: ParseStyle;
  declared: string[];
  unread: string[];
}

export interface FaceReport extends AppReport {
  component: string;
  tokens: string[];
  slotsDeclared: number;
  slotsRendered: boolean;
  nightExempt: boolean;
}

export interface Analysis {
  apps: AppReport[];
  faces: FaceReport[];
}

/** FACE_COMPONENTS block of face-components.ts -> { faceId: ComponentName }. */
export function parseFaceComponentMap(source: string): Record<string, string> {
  const start = source.indexOf('export const FACE_COMPONENTS');
  if (start === -1) return {};
  const end = source.indexOf('\n};', start);
  const block = source.slice(start, end === -1 ? undefined : end);
  const map: Record<string, string> = {};
  for (const m of block.matchAll(/^\s*'?([a-z][a-z0-9-]*)'?:\s*(\w+),?\s*$/gm)) map[m[1]] = m[2];
  return map;
}

/** 'app.photo-frame' -> 'photoFrameAppSchema' (the registry naming convention). */
export function schemaVariableName(schemaId: string): string {
  const dot = schemaId.indexOf('.');
  const kind = schemaId.slice(0, dot);
  const id = schemaId.slice(dot + 1);
  const camel = id
    .split('-')
    .map((part, i) => (i === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join('');
  return `${camel}${kind[0].toUpperCase()}${kind.slice(1)}Schema`;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function detectParseStyle(opts: {
  prop: 'config' | 'faceConfig';
  schemaVar: string | null;
  componentSource: string;
  sources: string[];
}): ParseStyle {
  const { prop, schemaVar, componentSource, sources } = opts;
  if (schemaVar) {
    const safe = new RegExp(`\\b${schemaVar}\\.safeParse\\(`);
    const throwing = new RegExp(`\\b${schemaVar}\\.parse\\(`);
    if (sources.some((s) => safe.test(s))) return 'safeParse';
    if (sources.some((s) => throwing.test(s))) return 'parse';
    // quoteAppSchema -> QuoteAppConfig: the inferred type, asserted unvalidated.
    const typeName = schemaVar.replace(/Schema$/, 'Config');
    const cast = new RegExp(
      `\\bas\\s+(?:Partial<)?${typeName[0].toUpperCase()}${escapeRe(typeName.slice(1))}\\b`,
    );
    if (sources.some((s) => cast.test(s))) return 'cast';
  }
  if (new RegExp(`\\b${prop}\\b`).test(componentSource)) return 'raw';
  return 'none';
}

export function readsIdentifier(sources: string[], name: string): boolean {
  const re = new RegExp(`\\b${escapeRe(name)}\\b`);
  return sources.some((s) => re.test(s));
}

const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);

/** A consumer that never touches its config prop reads no field, whatever
 *  identifiers its source happens to contain. */
function unreadFields(parse: ParseStyle, declared: string[], sources: string[]): string[] {
  if (parse === 'none') return declared;
  return declared.filter((f) => !readsIdentifier(sources, f));
}

export function analyzeDeclaredVsRead(input: AnalyzeInput): Analysis {
  const declaredFields = (schemaId: string | null): string[] =>
    schemaId && input.schemas[schemaId] ? Object.keys(input.schemas[schemaId].schema.shape) : [];

  const apps: AppReport[] = [...input.apps].sort(byId).map((app) => {
    const schemaId = input.schemas[`app.${app.id}`] ? `app.${app.id}` : null;
    const declared = declaredFields(schemaId);
    const texts = app.sources.map((s) => s.text);
    const componentSource = app.sources.find((s) => s.path === app.componentPath)?.text ?? '';
    const parse = detectParseStyle({
      prop: 'config',
      schemaVar: schemaId ? schemaVariableName(schemaId) : null,
      componentSource,
      sources: texts,
    });
    return { id: app.id, schemaId, parse, declared, unread: unreadFields(parse, declared, texts) };
  });

  const componentOf = parseFaceComponentMap(input.faceComponentsSource);
  const faces: FaceReport[] = [...input.faces].sort(byId).map((face) => {
    const component = componentOf[face.id] ?? '';
    const source = input.faceSources[component] ?? '';
    const schemaId = face.configSchemaId && input.schemas[face.configSchemaId] ? face.configSchemaId : null;
    const declared = declaredFields(schemaId);
    const parse = detectParseStyle({
      prop: 'faceConfig',
      schemaVar: schemaId ? schemaVariableName(schemaId) : null,
      componentSource: source,
      sources: [source],
    });
    return {
      id: face.id,
      component,
      schemaId,
      parse,
      declared,
      unread: unreadFields(parse, declared, [source]),
      tokens: [...new Set(source.match(/--face-[a-z]+(?:-[a-z]+)*/g) ?? [])].sort(),
      slotsDeclared: face.slots.length,
      slotsRendered: /\bslots?\b|Complication/.test(source),
      nightExempt: input.faceTokenExempt.includes(`${component}.tsx`),
    };
  });

  return { apps, faces };
}

// ---------------------------------------------------------------------------
// Markdown report
// ---------------------------------------------------------------------------

const PARSE_STYLES: ParseStyle[] = ['safeParse', 'parse', 'cast', 'raw'];
const list = (xs: string[]) => (xs.length ? xs.join(', ') : 'none');
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function summaryLine(kind: 'Apps' | 'Faces', prop: string, rows: AppReport[], tail = ''): string {
  const reads = rows.filter((r) => r.parse !== 'none').length;
  const withSchema = rows.filter((r) => r.schemaId).length;
  const breakdown = PARSE_STYLES.map((s) => `${s} ${rows.filter((r) => r.parse === s).length}`).join(', ');
  return (
    `- ${kind}: ${rows.length} registered; ${withSchema} with a schema; ${prop} read by ${reads} ` +
    `(${breakdown}); never read by ${rows.length - reads}${tail}.`
  );
}

export function renderDeclaredVsRead(analysis: Analysis): string {
  const { apps, faces } = analysis;
  const appDeclared = sum(apps.map((r) => r.declared.length));
  const faceDeclared = sum(faces.map((r) => r.declared.length));
  const appUnread = sum(apps.map((r) => r.unread.length));
  const faceUnread = sum(faces.map((r) => r.unread.length));
  const exempt = faces.filter((f) => f.nightExempt).length;
  const slots = (r: FaceReport) =>
    r.slotsDeclared ? `${r.slotsDeclared} declared, ${r.slotsRendered ? 'rendered' : 'not rendered'}` : '0';

  const lines = [
    '# Declared vs read',
    '',
    'Generated by `npm run analyze`. Refresh with `npm run analyze -- --write`; `npm test` fails while this file is stale (scripts/lib/analyze.test.ts), so what is committed is always current, and a PR that grows the unread list shows it in this diff.',
    '',
    "Heuristics, deliberately simple: a schema field counts as read when its key appears as a whole-word identifier anywhere in the consumer's sources. The parse column is how the consumer validates its config prop: `safeParse` is the house pattern (CalendarApp is the reference), `cast` is an unvalidated type assertion, `raw` reads the prop without a schema, `none` never touches it. An unread field is a setting the admin writes and nobody reads.",
    '',
    '## Summary',
    '',
    summaryLine('Apps', 'config', apps),
    summaryLine('Faces', 'faceConfig', faces, `; night-exempt ${exempt}`),
    `- Schema fields: ${appDeclared + faceDeclared} declared (${appDeclared} app, ${faceDeclared} face); ${appUnread + faceUnread} unread (${appUnread} app, ${faceUnread} face).`,
    '',
    '## Apps',
    '',
    '| App | Schema | Parse | Declared | Unread |',
    '|---|---|---|---|---|',
    ...apps.map((r) => `| ${r.id} | ${r.schemaId ?? 'none'} | ${r.parse} | ${r.declared.length} | ${list(r.unread)} |`),
    '',
    '## Faces',
    '',
    '| Face | Component | Parse | Declared | Unread | Tokens | Slots | Night-exempt |',
    '|---|---|---|---|---|---|---|---|',
    ...faces.map(
      (r) =>
        `| ${r.id} | ${r.component} | ${r.parse} | ${r.declared.length} | ${list(r.unread)} | ` +
        `${r.tokens.length ? r.tokens.join(' ') : 'none'} | ${slots(r)} | ${r.nightExempt ? 'yes' : 'no'} |`,
    ),
  ];
  return `${lines.join('\n')}\n`;
}
