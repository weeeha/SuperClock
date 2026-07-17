import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

const TOKEN_PATH = join(process.cwd(), 'config', 'admin.json');

// undefined = not loaded yet. Only definitive results (a token, or a
// confirmed-absent file) are cached; transient read errors retry per request.
let cachedToken: string | null | undefined;

// 'unavailable' = the token file exists but can't be read/parsed right now
// (wrong owner after a sudo edit, EIO, malformed JSON). Callers must fail
// CLOSED on it — treating it as "no token configured" would silently open
// the entire admin surface to the LAN.
export type TokenState = string | null | 'unavailable';

async function loadToken(): Promise<TokenState> {
  if (cachedToken !== undefined) return cachedToken;
  let raw: string;
  try {
    raw = await readFile(TOKEN_PATH, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      cachedToken = null; // genuinely unconfigured (dev / non-admin host)
      return cachedToken;
    }
    console.error('[admin-token] cannot read config/admin.json — failing closed:', err);
    return 'unavailable';
  }
  try {
    const parsed = JSON.parse(raw) as { token?: string };
    cachedToken = parsed.token ?? null;
    return cachedToken;
  } catch (err) {
    console.error('[admin-token] config/admin.json is not valid JSON — failing closed:', err);
    return 'unavailable';
  }
}

// Exposed for /auth/exchange and device-push, which need the expected token.
export async function getAdminToken(): Promise<TokenState> {
  return loadToken();
}

// Constant-time comparison that can't throw on length mismatch (Buffer
// lengths, not string lengths — multibyte input must not RangeError).
export function compareToken(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// If config/admin.json exists, require a matching bearer token or session
// cookie. If it doesn't exist (typical for dev), pass through.
export const adminTokenMiddleware: RequestHandler = async (req, res, next) => {
  const expected = await loadToken();
  if (expected === 'unavailable') {
    res.status(503).json({ error: 'auth temporarily unavailable' });
    return;
  }
  if (!expected) return next();

  const header = req.header('authorization') ?? '';
  const headerToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (headerToken && compareToken(headerToken, expected)) return next();

  const cookieToken = req.header('cookie')?.match(/superclock-admin=([^;]+)/)?.[1] ?? '';
  if (cookieToken && compareToken(cookieToken, expected)) return next();

  res.status(401).json({ error: 'unauthorized' });
};
