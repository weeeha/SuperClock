/** The CSS transition that fades the night filter out exactly by firesAt:
 *  the browser animates the whole gentle-wake ramp, no JavaScript ticks. */
export function rampTransition(firesAt: number, now: number): string {
  return `filter ${Math.max(0, Math.round(firesAt - now))}ms linear`;
}
