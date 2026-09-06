// Frozen rule debt, per (rule id, repo-relative file) → hits. Read by the tree
// gate (rulecheck-tree.test.ts) and the health report. May only shrink; a
// fixed row must be deleted (the gate's stale-row test fails otherwise).
// Frozen 2026-09-05 with five rows (NAV-1 x2, STA-3 x1, LAY-4 x2); emptied the
// same day once the debt was paid. Empty is the intended steady state: a new
// row here is a decision to carry debt, and it says why.
export const BASELINE = {};
