import type { Request, Response } from 'express';

// Defaults assume the Mac daemon (mac-daemon/claude-usage) is reachable
// over mDNS from the Pi. Override with CLAUDE_USAGE_URL on the Pi to point
// at a fixed IP.
const UPSTREAM = process.env.CLAUDE_USAGE_URL || 'http://Mikalais-Mac-Studio.local:47823/usage';
const CACHE_MS = 10_000;
const TIMEOUT_MS = 4_000;

interface UsagePayload {
  ok: boolean;
  fetchedAt: number;
  session: { utilization: number; resetAt: number; status: string };
  week: { utilization: number; resetAt: number };
  error?: string;
}

let cached: { payload: UsagePayload; at: number } | null = null;
let inflight: Promise<UsagePayload> | null = null;

async function fetchUpstream(): Promise<UsagePayload> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(UPSTREAM, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`upstream HTTP ${res.status}`);
    return (await res.json()) as UsagePayload;
  } finally {
    clearTimeout(t);
  }
}

export async function claudeUsageHandler(_req: Request, res: Response): Promise<void> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...cached.payload, proxyAgeMs: now - cached.at });
    return;
  }

  if (!inflight) {
    inflight = fetchUpstream()
      .then((payload) => {
        cached = { payload, at: Date.now() };
        return payload;
      })
      .finally(() => {
        inflight = null;
      });
  }

  try {
    const payload = await inflight;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...payload, proxyAgeMs: 0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (cached) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        ...cached.payload,
        ok: false,
        error: `proxy: ${message} (stale)`,
        proxyAgeMs: now - cached.at,
      });
      return;
    }
    res.status(503).json({
      ok: false,
      fetchedAt: 0,
      session: { utilization: 0, resetAt: 0, status: 'unknown' },
      week: { utilization: 0, resetAt: 0 },
      error: `proxy: ${message}`,
      proxyAgeMs: 0,
    });
  }
}
