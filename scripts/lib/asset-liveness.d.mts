export declare const COMPUTED_ASSET_DIRS: Record<string, string>;
export declare const ASSET_EXEMPT: Record<string, string>;
export declare function isComputed(rel: string): boolean;
export declare function auditAssets(relPaths: string[], corpus: string): string[];
