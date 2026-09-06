import type { Request, Response } from 'express';

// Server-side GitHub contributions proxy.
//
// The PAT must never reach the browser: a VITE_-prefixed token gets inlined
// into the public JS bundle and served to anyone on the LAN — and rotating it
// then requires a rebuild + redeploy. Server-side, GITHUB_TOKEN comes from
// the environment (/etc/default/superclock on the Pi) and rotation is just a
// service restart. Same single-flight + stale-serving shape as
// claude-usage-proxy.ts.
//
// `?username=<login>` (the app.github `username` option) switches the query
// from the token owner (viewer) to that user's public calendar. The login is
// validated before it is interpolated, and the cache is per login.

const GITHUB_GRAPHQL = 'https://api.github.com/graphql';
const CACHE_MS = 10 * 60_000; // contributions change slowly
const TIMEOUT_MS = 8_000;

/** GitHub login rules: alphanumerics and single hyphens, no leading or
 *  trailing hyphen, at most 39 characters. Anything else never reaches the
 *  query string. */
export function isValidLogin(login: string): boolean {
  return /^[A-Za-z\d](?:[A-Za-z\d]|-(?=[A-Za-z\d])){0,38}$/.test(login);
}

const CALENDAR_FIELDS = `
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
    }`;

/** viewer for the token owner (the historical shape), user(login:) otherwise. */
export function buildContributionsQuery(login: string | null): string {
  const subject = login ? `user(login: "${login}")` : 'viewer';
  return `
query {
  ${subject} {${CALENDAR_FIELDS}
  }
}`;
}

export interface ContributionsPayload {
  ok: boolean;
  username: string;
  totalContributions: number;
  weeks: { contributionDays: { contributionCount: number; date: string }[] }[];
  error?: string;
}

interface Subject {
  login: string;
  contributionsCollection: {
    contributionCalendar: {
      totalContributions: number;
      weeks: ContributionsPayload['weeks'];
    };
  };
}

const caches = new Map<string, { payload: ContributionsPayload; at: number }>();
const inflights = new Map<string, Promise<ContributionsPayload>>();

async function fetchUpstream(token: string, login: string | null): Promise<ContributionsPayload> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GITHUB_GRAPHQL, {
      method: 'POST',
      headers: {
        authorization: `bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: buildContributionsQuery(login) }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
    const json = (await res.json()) as {
      data?: { viewer?: Subject; user?: Subject | null };
      errors?: { message: string }[];
    };
    const subject = login ? json.data?.user : json.data?.viewer;
    if (!subject) {
      throw new Error(
        json.errors?.[0]?.message ??
          (login ? `GitHub API returned no user "${login}"` : 'GitHub API returned no viewer'),
      );
    }
    const calendar = subject.contributionsCollection.contributionCalendar;
    return {
      ok: true,
      username: subject.login,
      totalContributions: calendar.totalContributions,
      weeks: calendar.weeks,
    };
  } finally {
    clearTimeout(t);
  }
}

function empty(error: string): ContributionsPayload {
  return { ok: false, username: '', totalContributions: 0, weeks: [], error };
}

export async function githubContributionsHandler(req: Request, res: Response): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(503).json(empty('GITHUB_TOKEN not configured on the server'));
    return;
  }

  const raw = typeof req.query.username === 'string' ? req.query.username.trim() : '';
  if (raw && !isValidLogin(raw)) {
    res.status(400).json(empty('invalid GitHub username'));
    return;
  }
  const login = raw || null;
  const key = login ?? '';

  const now = Date.now();
  const cached = caches.get(key);
  if (cached && now - cached.at < CACHE_MS) {
    res.setHeader('Cache-Control', 'no-store');
    res.json(cached.payload);
    return;
  }

  let inflight = inflights.get(key);
  if (!inflight) {
    inflight = fetchUpstream(token, login)
      .then((payload) => {
        caches.set(key, { payload, at: Date.now() });
        return payload;
      })
      .finally(() => {
        inflights.delete(key);
      });
    inflights.set(key, inflight);
  }

  try {
    const payload = await inflight;
    res.setHeader('Cache-Control', 'no-store');
    res.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stale = caches.get(key);
    if (stale) {
      // Serve stale data but SAY it's stale — the kiosk shows its offline tell.
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ ...stale.payload, ok: false, error: `proxy: ${message} (stale)` });
      return;
    }
    res.status(503).json(empty(`proxy: ${message}`));
  }
}
