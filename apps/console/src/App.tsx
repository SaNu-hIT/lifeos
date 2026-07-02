import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createApiClient } from './lib/api';

const TOKEN_KEY = 'lifeos_console_token';

type Tab = 'skills' | 'connectors' | 'capabilities' | 'context';

interface SkillDescriptor {
  key: string;
  version: string;
  status: string;
  toolNames: string[];
  capabilities: string[];
}
interface ConnectorView {
  key: string;
  domain: string;
  healthy: boolean;
  details?: string;
}

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [tab, setTab] = useState<Tab>('skills');
  const [error, setError] = useState<string | null>(null);
  const api = useMemo(() => createApiClient('', () => token), [token]);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      const res = await createApiClient('', () => null).post<{ token: string }>('/v1/auth/session', {
        email: `console_${Date.now()}@lifeos.local`,
      });
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'sign-in failed');
    }
  }, []);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.brand}>LifeOS · <span style={{ color: '#7c9cff' }}>Console</span></div>
        <nav style={styles.nav}>
          {(['skills', 'connectors', 'capabilities', 'context'] as Tab[]).map((t) => (
            <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
        {!token ? (
          <button style={styles.primary} onClick={signIn}>Sign in (dev)</button>
        ) : (
          <button style={styles.ghost} onClick={() => { localStorage.removeItem(TOKEN_KEY); setToken(null); }}>
            Sign out
          </button>
        )}
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <main style={styles.main}>
        {!token ? (
          <p style={styles.muted}>Sign in to inspect the platform: registered Skills, Connectors, your capabilities, and the assembled Unified Context.</p>
        ) : tab === 'skills' ? (
          <Panel<SkillDescriptor[]> api={api} path="/v1/console/skills" title="Registered skills"
            render={(skills) => skills.length === 0
              ? <p style={styles.muted}>No skills installed in this deployment.</p>
              : skills.map((s) => (
                  <div key={s.key} style={styles.card}>
                    <strong>{s.key}</strong> <span style={styles.muted}>v{s.version} · {s.status}</span>
                    <div style={styles.muted}>tools: {s.toolNames.join(', ') || '—'}</div>
                    <div style={styles.muted}>capabilities: {s.capabilities.join(', ') || '—'}</div>
                  </div>
                ))} />
        ) : tab === 'connectors' ? (
          <Panel<ConnectorView[]> api={api} path="/v1/console/connectors" title="Connectors"
            render={(cs) => cs.length === 0
              ? <p style={styles.muted}>No connectors registered.</p>
              : cs.map((c) => (
                  <div key={c.key} style={styles.card}>
                    <strong>{c.key}</strong> <span style={styles.muted}>({c.domain})</span>
                    <span style={{ float: 'right', color: c.healthy ? '#5fd08a' : '#ff9db0' }}>
                      {c.healthy ? '● healthy' : '● down'}
                    </span>
                  </div>
                ))} />
        ) : tab === 'capabilities' ? (
          <Panel<string[]> api={api} path="/v1/console/capabilities" title="Your capabilities"
            render={(caps) => caps.length === 0
              ? <p style={styles.muted}>No capabilities granted (deny-by-default).</p>
              : <div style={styles.card}>{caps.map((c) => <span key={c} style={styles.pill}>{c}</span>)}</div>} />
        ) : (
          <Panel<unknown> api={api} path="/v1/console/context?scope=core" title="Assembled Unified Context"
            render={(ctx) => <pre style={styles.pre}>{JSON.stringify(ctx, null, 2)}</pre>} />
        )}
      </main>
    </div>
  );
}

function Panel<T>({ api, path, title, render }: {
  api: ReturnType<typeof createApiClient>;
  path: string;
  title: string;
  render: (data: T) => React.ReactNode;
}) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setErr(null);
    api.get<T>(path).then((d) => live && setData(d)).catch((e: Error) => live && setErr(e.message));
    return () => { live = false; };
  }, [api, path]);

  return (
    <section>
      <h3 style={styles.heading}>{title}</h3>
      {err ? <p style={{ color: '#ff9db0' }}>{err}</p> : data === null ? <p style={styles.muted}>Loading…</p> : render(data)}
    </section>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return { ...styles.ghost, color: active ? '#fff' : '#9aa4bf', borderBottom: active ? '2px solid #7c9cff' : '2px solid transparent', borderRadius: 0, textTransform: 'capitalize' };
}

const styles: Record<string, React.CSSProperties> = {
  app: { minHeight: '100vh', background: '#0b0e17', color: '#e6e9f2', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', gap: 20, padding: '14px 24px', borderBottom: '1px solid #1c2333' },
  brand: { fontWeight: 700, fontSize: 18 },
  nav: { display: 'flex', gap: 6, flex: 1 },
  main: { maxWidth: 900, margin: '0 auto', padding: 24 },
  heading: { fontSize: 14, color: '#9aa4bf', textTransform: 'uppercase', letterSpacing: 1 },
  card: { background: '#121826', border: '1px solid #1c2333', borderRadius: 10, padding: 14, marginBottom: 8 },
  muted: { color: '#9aa4bf', fontSize: 14 },
  pill: { display: 'inline-block', fontSize: 12, background: '#25314f', color: '#9db4ff', padding: '3px 10px', borderRadius: 999, margin: 4 },
  pre: { background: '#121826', border: '1px solid #1c2333', borderRadius: 10, padding: 14, fontSize: 12, color: '#c3cae0', overflowX: 'auto' },
  primary: { background: '#3a56d4', color: '#fff', border: 0, padding: '8px 14px', borderRadius: 8, cursor: 'pointer' },
  ghost: { background: 'transparent', color: '#c3cae0', border: 0, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' },
  error: { background: '#3a1520', color: '#ff9db0', padding: '10px 24px', fontSize: 14 },
};
