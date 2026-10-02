// Ask this clock's own server to keep the panel on until `untilMs` (the
// display adapter switches it off for the sleep schedule and, on fastclock,
// when radar sees nobody). Fire and forget: the alert rings either way.
export function requestPanelWake(untilMs: number): void {
  try {
    void fetch('/api/device/wake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ untilMs: Math.round(untilMs) }),
    }).catch(() => {});
  } catch {
    // No fetch here (tests, very old engines): nothing to wake.
  }
}
