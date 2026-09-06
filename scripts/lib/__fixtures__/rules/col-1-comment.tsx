// Fixture: must NOT trip COL-1 — the banned pattern lives only in prose.
// A header explaining the ban quotes it: never write bg-gradient-to-r here.
/* Nor the block-comment spelling: bg-gradient-to-b from-emerald-500. */
export const Clean = () => <div className="bg-sheet">x</div>;
