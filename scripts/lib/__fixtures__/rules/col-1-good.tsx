// Fixture: must NOT trip COL-1. The word "gradient" appears in prose only,
// which is the false positive a naive pattern would produce.
// A gradient would be wrong here; this uses a flat token instead.
export const Good = () => <div className="bg-sheet">x</div>;
