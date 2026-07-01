import type React from 'react';
import { useEffect, useState } from 'react';
import type { ApiClient } from '../lib/api';
import type { ActivityView, HomeView, NotificationView } from '../types';

interface Props {
  api: ApiClient;
  /** Bumped on any realtime event so the surface refetches live (phase 29). */
  pulse: number;
}

export function Home({ api, pulse }: Props) {
  const [home, setHome] = useState<HomeView | null>(null);
  const [activity, setActivity] = useState<ActivityView[]>([]);
  const [notifications, setNotifications] = useState<NotificationView[]>([]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [h, a, n] = await Promise.all([
        api.get<HomeView>('/v1/home').catch(() => ({ widgets: [] })),
        api.getPage<ActivityView>('/v1/activities').catch(() => ({ items: [] })),
        api.getPage<NotificationView>('/v1/notifications').catch(() => ({ items: [] })),
      ]);
      if (!live) return;
      setHome(h);
      setActivity(a.items);
      setNotifications(n.items);
    })();
    return () => {
      live = false;
    };
  }, [api, pulse]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section>
        <h3 style={heading}>Your home</h3>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {home?.widgets.length ? (
            home.widgets.map((w) => (
              <div key={w.key} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{w.title}</strong>
                  {w.pinned && <span style={pill}>pinned</span>}
                </div>
                <pre style={pre}>{JSON.stringify(w.data.props, null, 2)}</pre>
              </div>
            ))
          ) : (
            <p style={muted}>No widgets yet — enable a Skill to populate your home.</p>
          )}
        </div>
      </section>

      <section>
        <h3 style={heading}>Notifications</h3>
        {notifications.length ? (
          notifications.map((n) => (
            <div key={n.id} style={{ ...row, opacity: n.readAt ? 0.55 : 1 }}>
              <strong>{n.title}</strong>
              {n.body && <span style={muted}> — {n.body}</span>}
            </div>
          ))
        ) : (
          <p style={muted}>Nothing new.</p>
        )}
      </section>

      <section>
        <h3 style={heading}>Recent activity</h3>
        {activity.length ? (
          activity.map((a) => (
            <div key={a.id} style={row}>
              <strong>{a.title}</strong>
              {a.summary && <span style={muted}> · {a.summary}</span>}
              <span style={{ ...muted, float: 'right' }}>{new Date(a.occurredAt).toLocaleString()}</span>
            </div>
          ))
        ) : (
          <p style={muted}>No activity yet.</p>
        )}
      </section>
    </div>
  );
}

const heading: React.CSSProperties = { fontSize: 15, color: '#9aa4bf', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 1 };
const card: React.CSSProperties = { background: '#121826', border: '1px solid #1c2333', borderRadius: 12, padding: 14 };
const row: React.CSSProperties = { background: '#121826', border: '1px solid #1c2333', borderRadius: 10, padding: '10px 14px', marginBottom: 8 };
const muted: React.CSSProperties = { color: '#9aa4bf', fontSize: 14 };
const pill: React.CSSProperties = { fontSize: 11, background: '#25314f', color: '#9db4ff', padding: '2px 8px', borderRadius: 999 };
const pre: React.CSSProperties = { margin: '8px 0 0', fontSize: 12, color: '#c3cae0', whiteSpace: 'pre-wrap' };
