// Fixture: must trip CPY-5 — an em dash and a middle-dot join on the glass.
export const Bad = ({ when, who }: { when: string; who: string }) => (
  <p>
    {`${when} · ${who}`}
    <span>All clear — tap Add to capture something.</span>
  </p>
);
