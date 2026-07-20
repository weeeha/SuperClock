import type { Request, Response } from 'express';

// Server-side GitHub contributions proxy.
//
// The PAT must never reach the browser: a VITE_-prefixed token gets inlined
// into the public JS bundle and served to anyone on the LAN — and rotating it
// then requires a rebuild + redeploy. Server-side, GITHUB_TOKEN comes from
// the environment (/etc/default/superclock on the Pi) and rotation is just a
// service restart. Same single-flight + stale-serving shape as
// claude-usage-proxy.ts.

const GITHUB_GRAPHQL = 'https://api.github.com/graphql';
const CACHE_MS = 10 * 60_000; // contributions change slowly
const TIMEOUT_MS = 8_000;

const QUERY = `
query {
  viewer {
    login
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
    }
  }
}`;

export interface ContributionsPayload {
  ok: boolean;
  username: string;
  totalContributions: number;
  weeks: { contributionDays: { contributionCount: number; date: string }[] }[];
  error?: string;
}

let cached: { payload: ContributionsPayload; at: number } | null = null;
let inflight: Promise<ContributionsPayload> | null = null;

async function fetchUpstream(token: string): Promise<ContributionsPayload> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GITHUB_GRAPHQL, {
      method: 'POST',
      headers: {
        authorization: `bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: QUERY }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
    const json = (await res.json()) as {
      data?: {
        viewer?: {
          login: string;
          contributionsCollection: {
            contributionCalendar: {
              totalContributions: number;
              weeks: ContributionsPayload['weeks'];
            };
          };
        };
      };
      errors?: { message: string }[];
    };
    const viewer = json.data?.viewer;
    if (!viewer) {
      throw new Error(json.errors?.[0]?.message ?? 'GitHub API returned no viewer');
    }
    const calendar = viewer.contributionsCollection.contributionCalendar;
    return {
      ok: true,
      username: viewer.login,
      totalContributions: calendar.totalContributions,
      weeks: calendar.weeks,
    };
  } finally {
    clearTimeout(t);
  }
}

export async function githubContributionsHandler(_req: Request, res: Response): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(503).json({
      ok: false,
      username: '',
      totalContributions: 0,
      weeks: [],
      error: 'GITHUB_TOKEN not configured on the server',
    });
    return;
  }

  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) {
    res.setHeader('Cache-Control', 'no-store');
    res.json(cached.payload);
    return;
  }

  if (!inflight) {
    inflight = fetchUpstream(token)
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
    res.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (cached) {
      // Serve stale data but SAY it's stale — the kiosk shows its offline tell.
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ ...cached.payload, ok: false, error: `proxy: ${message} (stale)` });
      return;
    }
    res.status(503).json({
      ok: false,
      username: '',
      totalContributions: 0,
      weeks: [],
      error: `proxy: ${message}`,
    });
  }
}
