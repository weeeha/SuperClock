// Frozen rule debt, per (rule id, repo-relative file) → hits. Read by the tree
// gate (rulecheck-tree.test.ts) and the health report. May only shrink; a
// fixed row must be deleted (the gate's stale-row test fails otherwise).
// Frozen 2026-09-05 with five rows (NAV-1 x2, STA-3 x1, LAY-4 x2); emptied the
// same day once the debt was paid. Empty is the intended steady state: a new
// row here is a decision to carry debt, and it says why.
//
// Refilled 2026-09-07 with ICO-2 debt, uncovered by widening that rule's
// pattern rather than by any new code. It had only ever matched
// U+1F300-1FAFF plus sparkles, so the whole Misc Symbols and Dingbats block
// (U+2600-27BF) walked past a blocker rule: a heart, a coffee cup, a tick, a
// heavy pause bar and the entire weather condition set. Seventeen hits in
// eight files, none of them new, all of them shipped for months. The eight
// weather ones were paid the same day, and Todo's three soon after; six
// remain across six files.
//
// They are recorded rather than fixed because every one is a visible design
// decision inside an app or a face, and this repo's rule is that a face's look
// is the product — a red check on a deliberate design is a conversation, not a
// fix-forward. The rows carry the substitution each one is waiting for.
export const BASELINE = {
  // The caffeine complication draws a coffee cup. Both faces are on
  // FACE_TOKEN_EXEMPT already; retiring the glyph is part of their night-token
  // retrofit, not a drive-by swap. Substitution: lucide `Coffee`.
  'ICO-2 src/apps/clock/ComplicationsDark.tsx': 1,
  'ICO-2 src/apps/clock/ComplicationsLight.tsx': 1,

  // The monthly streak allowance renders as hearts, and the paused headline as
  // a heavy double bar. Both are real state, not decoration — the hearts dim to
  // 0.22 when spent — so they need an icon, not deletion. Substitution: lucide
  // `Heart` and `Pause`. The test row pins the same string the view model emits.
  'ICO-2 src/apps/fitness/WatchFace.tsx': 1,
  'ICO-2 src/apps/fitness/view-model.ts': 1,
  'ICO-2 src/apps/fitness/view-model.test.ts': 1,

  // TodoApp's three (two ticks and a close cross) are paid: the Todo design
  // pass took them to lucide Check / X, and the mini-keyboard's space and
  // backspace keys with them.
  //
  // What is left is the registry icon, and it is a different problem. The
  // `icon` field on AppMetadata is DEAD: the kiosk never renders it, and the
  // admin's tile art comes from APP_ICONS (real file paths) via add-screen.ts,
  // not from here. All fourteen apps carry one; thirteen write it as a
  // `\u{...}` escape, which is why only Todo's literal trips the rule. Deleting
  // the field is a fourteen-file change and a types change, not a design pass,
  // so it waits for one that is scoped to it.
  'ICO-2 src/apps/todo/index.ts': 1,

  // The weather row that stood here (8 hits, the whole condition glyph set) is
  // gone: the Weather design pass replaced the emoji with drawn marks in
  // ConditionMark.tsx, which is what the row said it was waiting for. Nine
  // hits of debt paid, seven remain.
};
