#!/usr/bin/env node
// Polls Anthropic rate-limit headers using the local Claude Code OAuth token
// from macOS Keychain, exposes the latest reading as JSON on the LAN.
// Inspired by HermannBjorgvin/Clawdmeter's BLE daemon, adapted for HTTP.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { networkInterfaces, hostname } from 'node:os';

const execFileP = promisify(execFile);

const PORT = parseInt(process.env.PORT || '47823', 10);
const POLL_MS = parseInt(process.env.POLL_INTERVAL_MS || '60000', 10);
const KEYCHAIN_SERVICE = 'Claude Code-credentials';
const KEYCHAIN_ACCOUNT = process.env.USER || '';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

let latest = {
  ok: false,
  fetchedAt: 0,
  session: { utilization: 0, resetAt: 0, status: 'unknown' },
  week: { utilization: 0, resetAt: 0 },
  error: 'no poll yet',
};

async function readToken() {
  const { stdout } = await execFileP('security', [
    'find-generic-password',
    '-s', KEYCHAIN_SERVICE,
    '-a', KEYCHAIN_ACCOUNT,
    '-w',
  ]);
  const parsed = JSON.parse(stdout.trim());
  const tok = parsed?.claudeAiOauth?.accessToken;
  if (!tok) throw new Error('no accessToken in keychain entry');
  return tok;
}

async function poll() {
  let token;
  try {
    token = await readToken();
  } catch (e) {
    latest = { ...latest, ok: false, error: `keychain: ${e.message}`, fetchedAt: Date.now() };
    return;
  }

  let res;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Type': 'application/json',
        'User-Agent': 'claude-code/2.1.5',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
  } catch (e) {
    latest = { ...latest, ok: false, error: `network: ${e.message}`, fetchedAt: Date.now() };
    return;
  }

  // Read body to free the socket, but discard.
  try { await res.text(); } catch {}

  const h = res.headers;
  const num = (k) => {
    const v = h.get(k);
    return v == null ? null : Number(v);
  };

  const s5h_util = num('anthropic-ratelimit-unified-5h-utilization');
  const s5h_reset = num('anthropic-ratelimit-unified-5h-reset');
  const s7d_util = num('anthropic-ratelimit-unified-7d-utilization');
  const s7d_reset = num('anthropic-ratelimit-unified-7d-reset');
  const status = h.get('anthropic-ratelimit-unified-5h-status') || 'unknown';

  if (s5h_util == null && s7d_util == null) {
    latest = {
      ...latest,
      ok: false,
      error: `no rate-limit headers (HTTP ${res.status})`,
      fetchedAt: Date.now(),
    };
    return;
  }

  latest = {
    ok: true,
    fetchedAt: Date.now(),
    session: {
      utilization: s5h_util ?? 0,
      resetAt: (s5h_reset ?? 0) * 1000,
      status,
    },
    week: {
      utilization: s7d_util ?? 0,
      resetAt: (s7d_reset ?? 0) * 1000,
    },
  };
}

function lanIps() {
  const out = [];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, pollMs: POLL_MS, fetchedAt: latest.fetchedAt }));
    return;
  }

  if (req.url === '/usage') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(latest));
    return;
  }

  res.statusCode = 404;
  res.end('not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[claude-usage] listening on :${PORT}`);
  console.log(`[claude-usage] host: ${hostname()}`);
  for (const ip of lanIps()) console.log(`[claude-usage] http://${ip}:${PORT}/usage`);
});

await poll();
setInterval(poll, POLL_MS);
