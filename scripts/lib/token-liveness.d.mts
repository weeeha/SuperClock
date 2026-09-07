// Types for token-liveness.mjs so src/shared/token-liveness.test.ts (inside
// tsconfig.app's strict `include: ["src"]`) can import the .mjs without
// allowJs. Keep in step with the .mjs by hand; the unit tests are the check.

export interface TokenSource {
  file: string;
  text: string;
}

export interface LedgerEntry {
  token: string;
  reason: string;
}

export interface LivenessAudit {
  live: string[];
  ledgered: string[];
  dead: string[];
  staleLedger: string[];
}

export declare function declaredTokens(cssText: string): string[];
export declare function stripDeclarations(cssText: string): string;
export declare function readerPattern(token: string): RegExp;
export declare function findReaders(token: string, sources: TokenSource[]): string[];
export declare function auditLiveness(
  tokens: string[],
  sources: TokenSource[],
  ledger?: LedgerEntry[],
  extraLive?: Iterable<string>,
): LivenessAudit;
export declare const UNCONSUMED_LEDGER: LedgerEntry[];
