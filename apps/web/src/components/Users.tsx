import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '../lib/api';
import type { AdminUser } from '../types';

interface Props {
  api: ApiClient;
}

/** Admin/overview tab: every user and the preferences they've saved across Skills.
 *  Backed by the dev-only /v1/dev/users endpoint (disabled in production). */
export function Users({ api }: Props) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .get<AdminUser[]>('/v1/dev/users')
      .then(setUsers)
      .catch((e: Error) => setError(e.message));
  }, [api]);

  useEffect(load, [load]);

  return (
    <section>
      <h3 style={heading}>Users &amp; saved preferences</h3>
      {error && <p style={{ color: '#ff9db0', fontSize: 14 }}>{error}</p>}
      {users === null ? (
        <p style={muted}>Loading…</p>
      ) : users.length === 0 ? (
        <p style={muted}>No users yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {users.map((u) => (
            <div key={u.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <strong style={{ fontSize: 15 }}>{u.email}</strong>
                <span style={mono}>{u.id.slice(0, 8)}</span>
                <span style={{ ...muted, marginLeft: 'auto' }}>
                  joined {new Date(u.createdAt).toLocaleDateString()}
                </span>
              </div>
              {u.preferences.length === 0 ? (
                <div style={{ ...muted, marginTop: 8 }}>No saved preferences.</div>
              ) : (
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Item</th>
                      <th style={th}>Preferred brand</th>
                      <th style={th}>Pack</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.preferences.map((p) => (
                      <tr key={p.productName}>
                        <td style={{ ...td, textTransform: 'capitalize' }}>{p.productName}</td>
                        <td style={td}>{p.preferredBrand}</td>
                        <td style={td}>{p.preferredUnit ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const heading: React.CSSProperties = {
  fontSize: 15, color: '#9aa4bf', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1,
};
const card: React.CSSProperties = {
  background: '#121826', border: '1px solid #1c2333', borderRadius: 12, padding: 16,
};
const muted: React.CSSProperties = { color: '#9aa4bf', fontSize: 14 };
const mono: React.CSSProperties = {
  color: '#7c9cff', fontSize: 12.5, fontFamily: 'ui-monospace, monospace',
};
const table: React.CSSProperties = {
  width: '100%', marginTop: 10, borderCollapse: 'collapse', fontSize: 14,
};
const th: React.CSSProperties = {
  textAlign: 'left', color: '#9aa4bf', fontWeight: 500, fontSize: 12,
  textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 8px', borderBottom: '1px solid #1c2333',
};
const td: React.CSSProperties = {
  color: '#e6e9f2', padding: '6px 8px', borderBottom: '1px solid #141b2b',
};
