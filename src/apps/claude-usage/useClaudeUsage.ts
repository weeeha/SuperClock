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

export function useClaudeUsage(isActive: boolean): {
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
    const id = setInterval(load, POLL_MS);
    return () => {
      aborted.current = true;
      clearInterval(id);
    };
  }, [isActive]);

  return { data, loading };
}
