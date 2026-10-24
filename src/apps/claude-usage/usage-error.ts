// The daemon (mac-daemon/claude-usage/usage-server.mjs) and the Pi proxy
// (server/claude-usage-proxy.ts) each prefix their errors: `keychain:`,
// `network:`, `proxy:`, or the bare `no poll yet`. Those strings are for the
// journal, not the glass; the kiosk shows what happened and what to do, in
// the app's own lower-case terminal register.

export interface UsageErrorCopy {
  /** Short state, drawn where the numbers would be. */
  label: string;
  /** One sentence on what to do, drawn under the label. */
  detail: string;
}

export function describeUsageError(error: string | undefined): UsageErrorCopy {
  const e = (error ?? '').trim();
  if (e.startsWith('keychain:')) {
    return { label: 'signed out on the mac', detail: 'open claude code on the mac to sign in again' };
  }
  if (e.startsWith('proxy:')) {
    return { label: 'mac unreachable', detail: 'the usage daemon on the mac did not answer' };
  }
  if (e.startsWith('network:')) {
    return { label: 'mac offline', detail: 'the mac could not reach anthropic' };
  }
  if (e === 'no poll yet') {
    return { label: 'first reading pending', detail: 'the daemon has not polled yet' };
  }
  return { label: 'usage unavailable', detail: 'no reading from the mac right now' };
}
