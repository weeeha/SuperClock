// Shared vertical geometry of the Classic calendar, in percent of the disc
// height measured from the bottom. The honest tell and the month grid used to
// be placed independently; a six-row month put its last row under the tell.

/** The tell ("calendar not configured" / "offline · cached"): one 2.8vmin line. */
export const CALENDAR_TELL = { bottomPct: 13, heightPct: 3 } as const;

/** Where the month grid's weeks band ends. Must clear the tell's band. */
export const MONTH_GRID_BOTTOM_PCT = 20;
