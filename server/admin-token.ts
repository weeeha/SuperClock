import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

const TOKEN_PATH = join(process.cwd(), 'config', 'admin.json');

let cachedToken: string | null = null;
let loaded = false;

async function loadToken(): Promise<string | null> {
  if (loaded) return cachedToken;
  loaded = true;
  try {
    const raw = await readFile(TOKEN_PATH, 'utf8');
    const parsed = JSON.parse(raw) as { token?: string };
    cachedToken = parsed.token ?? null;
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

// Exposed for /auth/exchange which needs the expected token to compare against.
export async function getAdminToken(): Promise<string | null> {
  return loadToken();
}

function compareToken(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// v1 stub: if config/admin.json exists, require a matching bearer token or
// session cookie. If it doesn't exist (typical for dev), pass through.
// Real cookie-based flow lands in step 9.
export const adminTokenMiddleware: RequestHandler = async (req, res, next) => {
  const expected = await loadToken();
  if (!expected) return next();

  const header = req.header('authorization') ?? '';
  const headerToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (headerToken && compareToken(headerToken, expected)) return next();

  // Session cookie support placeholder — step 9 sets a httpOnly cookie here.
  const cookieToken = req.header('cookie')?.match(/superclock-admin=([^;]+)/)?.[1] ?? '';
  if (cookieToken && compareToken(cookieToken, expected)) return next();

  res.status(401).json({ error: 'unauthorized' });
};
