export interface IndexRow {
  kind: string;
  id: string;
  path: string;
  accent: string;
  parity: string;
  geometry: string;
  purpose: string;
}
export declare const WIDGET_META_PATHS: string[];
export declare const INDEX_COLUMNS: string[];
export declare function firstSentence(text: string): string;
export declare function partRow(meta: unknown, path: string): IndexRow;
export declare function emitIndex(rows: IndexRow[]): string;
export declare function collectMetaPaths(globSync: (pattern: string) => string[]): string[];
