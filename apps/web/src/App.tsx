import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createApiClient } from './lib/api';
import { subscribeRealtime } from './lib/realtime';
import type { Me } from './types';
import { Home } from './components/Home';
import { Chat } from './components/Chat';
import { Skills } from './components/Skills';
import { Users } from './components/Users';

const TOKEN_KEY = 'lifeos_token';

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<'home' | 'chat' | 'skills' | 'users'>('home');
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0); // bumped on any realtime event → children refetch

  const api = useMemo(() => createApiClient('', () => token), [token]);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      const res = await createApiClient('', () => null).post<{ token: string; userId: string }>(
        '/v1/auth/session',
        { email: `demo_${Date.now()}@lifeos.local` },
      );
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      // Dev convenience: grant the demo user the Pro plan so Skill tools are permitted
      // (grocery.*/calendar.*). Without this a fresh user has no capabilities and the
      // planner sees no tools. Best-effort — ignore if the endpoint is disabled.
      await createApiClient('', () => res.token)
        .post('/v1/dev/subscribe', { planKey: 'pro' })
        .catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'sign-in failed');
    }
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMe(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    api.get<Me>('/v1/me').then(setMe).catch((e: Error) => setError(e.message));
    // Ensure capabilities for any session (incl. ones from before auto-subscribe existed),
    // so Skill tools are permitted. Idempotent, best-effort.
    api.post('/v1/dev/subscribe', { planKey: 'pro' }).catch(() => undefined);
  }, [api, token]);

  // Live updates: any event bumps a pulse counter the panels watch.
  useEffect(() => {
    if (!token) return;
    return subscribeRealtime(`/v1/realtime/stream?token=${encodeURIComponent(token)}`, () =>
      setPulse((n) => n + 1),
    );
  }, [token]);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.brand}>Life<span style={{ color: '#7c9cff' }}>OS</span></div>
        <nav style={styles.nav}>
          <button style={tabStyle(tab === 'home')} onClick={() => setTab('home')}>Home</button>
          <button style={tabStyle(tab === 'chat')} onClick={() => setTab('chat')}>Chat</button>
          <button style={tabStyle(tab === 'skills')} onClick={() => setTab('skills')}>Skills</button>
          <button style={tabStyle(tab === 'users')} onClick={() => setTab('users')}>Users</button>
        </nav>
        <div style={styles.session}>
          {me ? (
            <>
              <span style={styles.muted}>{me.email ?? me.id.slice(0, 8)}</span>
              <button style={styles.ghost} onClick={signOut}>Sign out</button>
            </>
          ) : (
            <button style={styles.primary} onClick={signIn}>Sign in (dev)</button>
          )}
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <main style={tab === 'chat' ? { ...styles.main, maxWidth: 1200 } : styles.main}>
        {!token ? (
          <div style={styles.empty}>
            <h2>Welcome to LifeOS</h2>
            <p style={styles.muted}>
              Your AI-first personal operating system. Sign in to see your home surface and chat.
            </p>
          </div>
        ) : tab === 'home' ? (
          <Home api={api} pulse={pulse} />
        ) : tab === 'chat' ? (
          <Chat api={api} />
        ) : tab === 'skills' ? (
          <Skills api={api} />
        ) : (
          <Users api={api} />
        )}
      </main>
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    ...styles.ghost,
    color: active ? '#fff' : '#9aa4bf',
    borderBottom: active ? '2px solid #7c9cff' : '2px solid transparent',
    borderRadius: 0,
  };
}

const styles: Record<string, React.CSSProperties> = {
  app: { minHeight: '100vh', background: '#0b0e17', color: '#e6e9f2', fontFamily: 'system-ui, sans-serif' },
  header: {
    display: 'flex', alignItems: 'center', gap: 24, padding: '14px 24px',
    borderBottom: '1px solid #1c2333', position: 'sticky', top: 0, background: '#0b0e17',
  },
  brand: { fontWeight: 700, fontSize: 20, letterSpacing: 0.5 },
  nav: { display: 'flex', gap: 8, flex: 1 },
  session: { display: 'flex', alignItems: 'center', gap: 12 },
  main: { maxWidth: 860, margin: '0 auto', padding: 24 },
  empty: { textAlign: 'center', marginTop: 80, color: '#c3cae0' },
  muted: { color: '#9aa4bf', fontSize: 14 },
  error: { background: '#3a1520', color: '#ff9db0', padding: '10px 24px', fontSize: 14 },
  primary: { background: '#3a56d4', color: '#fff', border: 0, padding: '8px 14px', borderRadius: 8, cursor: 'pointer' },
  ghost: { background: 'transparent', color: '#c3cae0', border: 0, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' },
};
