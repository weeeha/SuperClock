// Fixture: must NOT trip CPY-5 — a comma joins, a period ends, a live dot marks a state.
export const Good = ({ when, who, live }: { when: string; who: string; live: boolean }) => (
  <p>
    {`${when}, ${who}`}
    <span>All clear. Tap Add to capture something.</span>
    {live && <span aria-label="live">●</span>}
  </p>
);
