// Fixture: must NOT trip SUR-1. The words "black" and "white" appear in prose
// only, which is the false positive a naive pattern would produce.
// A black surface would be wrong here; the palette tokens flip at night.
export const Good = () => (
  <div className="h-full w-full bg-(--face-bg) text-(--face-ink)">x</div>
);
