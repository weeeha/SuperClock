import { useEffect, useRef, useState } from 'react';

export interface UsagePayload {
  ok: boolean;
  fetchedAt: number;
  session: { utilization: number; resetAt: number; status: string };
  week: { utilization: number; resetAt: number };
  error?: string;
  proxyAgeMs?: number;
}

const ENDPOINT = '/api/claude-usage';
const POLL_MS = 30_000;

/** Polls the proxy every `pollMs` (app.claude-usage refreshSeconds) while active. */
export function useClaudeUsage(
  isActive: boolean,
  pollMs: number = POLL_MS,
): {
  data: UsagePayload | null;
  loading: boolean;
} {
  const [data, setData] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const aborted = useRef(false);

  useEffect(() => {
    if (!isActive) return;
    aborted.current = false;

    async function load() {
      try {
        const res = await fetch(ENDPOINT);
        const json = (await res.json()) as UsagePayload;
        if (!aborted.current) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (!aborted.current) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, pollMs);
    return () => {
      aborted.current = true;
      clearInterval(id);
    };
  }, [isActive, pollMs]);

  return { data, loading };
}
