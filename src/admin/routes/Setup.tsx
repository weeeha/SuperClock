import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

type Status = 'idle' | 'pending' | 'ok' | 'error';

export default function Setup() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<Status>(token ? 'pending' : 'idle');
  const [error, setError] = useState<string | null>(null);

  // A freshly-arrived token starts a new exchange. Reset to pending during
  // render ("adjust state during render") so the synchronous setState no
  // longer lives in the Effect body; the Effect just does the fetch.
  const [exchangingToken, setExchangingToken] = useState(token);
  if (token && token !== exchangingToken) {
    setExchangingToken(token);
    setStatus('pending');
    setError(null);
  }

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/auth/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include',
    })
      .then(async (res) => {
        if (res.status === 204) {
          // Open mode (dev) — proceed without a cookie.
          setStatus('ok');
          setTimeout(() => navigate('/', { replace: true }), 400);
          return;
        }
        if (res.ok) {
          setStatus('ok');
          setTimeout(() => navigate('/', { replace: true }), 400);
          return;
        }
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus('error');
        setError(body?.error ?? `HTTP ${res.status}`);
      })
      .catch((err: unknown) => {
        setStatus('error');
        setError((err as Error).message);
      });
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>SuperClock Admin Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!token && (
            <>
              <p>
                Open the setup URL printed by <code>setup-pi.sh</code> on a phone or
                laptop on the same network. The URL includes a one-time token.
              </p>
              <p className="opacity-60">
                Example: <code>http://superclock-fast.local:3000/admin/setup?token=…</code>
              </p>
            </>
          )}
          {token && status === 'pending' && <p>Exchanging token for session…</p>}
          {token && status === 'ok' && (
            <p>Session established. Redirecting to admin…</p>
          )}
          {token && status === 'error' && (
            <>
              <p className="text-[hsl(var(--destructive))]">Failed: {error}</p>
              <Button onClick={() => navigate('/setup')} variant="secondary" size="sm">
                Start over
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
