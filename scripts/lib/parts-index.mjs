// The parts index: one row per face and kiosk widget, emitted from the meta
// files so it can never disagree with them for long (src/shared/parts-index.test.ts
// fails when the committed index/parts.toon differs from a fresh emit).
// TOON shape, the format the newer design-system repos trained agents on:
//   parts[N]{col,col,...}:
//     value,value,...
// Fs-free; scripts/build-index.mjs and the drift test own the reads.

/** Widget metas live beside their components, which are not all under one
 *  directory yet (StateRing is in the agents app). One list, imported by the
 *  contract gate and the index alike. */
export const WIDGET_META_PATHS = ['src/core/widgets/RoundList.meta.json', 'src/apps/agents/StateRing.meta.json'];

export const INDEX_COLUMNS = ['kind', 'id', 'path', 'accent', 'parity', 'geometry', 'purpose'];

export function firstSentence(text) {
  const i = text.indexOf('. ');
  return (i === -1 ? text : text.slice(0, i + 1)).trim();
}

export function partRow(meta, path) {
  const base = { kind: meta.kind, id: meta.id, path, purpose: firstSentence(meta.purpose) };
  if (meta.kind !== 'face') return { ...base, accent: '-', parity: '-', geometry: '-' };
  return {
    ...base,
    accent: meta.accent ? meta.accent.color : 'none',
    parity: meta.parity.lvgl ? 'lvgl' : 'none',
    geometry: meta.spec ? 'spec' : meta.specless ? 'specless' : 'pending',
  };
}

function quote(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function emitIndex(rows) {
  const sorted = [...rows].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  const lines = [
    `parts[${sorted.length}]{${INDEX_COLUMNS.join(',')}}:`,
    ...sorted.map((r) => '  ' + INDEX_COLUMNS.map((c) => quote(r[c])).join(',')),
  ];
  return lines.join('\n') + '\n';
}

export function collectMetaPaths(globSync) {
  return [...globSync('src/apps/clock/*.meta.json'), ...WIDGET_META_PATHS].sort();
}
