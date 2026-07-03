import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '../lib/api';

interface SkillView {
  key: string;
  title?: string;
  description?: string;
  version: string;
  status: string;
  toolNames: string[];
  capabilities: string[];
  enabled: boolean;
}

interface Props {
  api: ApiClient;
}

export function Skills({ api }: Props) {
  const [skills, setSkills] = useState<SkillView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<SkillView[]>('/v1/console/skills')
      .then(setSkills)
      .catch((e: Error) => setError(e.message));
  }, [api]);

  useEffect(load, [load]);

  const toggle = useCallback(
    async (skill: SkillView) => {
      setBusyKey(skill.key);
      setError(null);
      try {
        await api.post(`/v1/console/skills/${skill.key}/enabled`, { enabled: !skill.enabled });
        setSkills((list) =>
          (list ?? []).map((s) => (s.key === skill.key ? { ...s, enabled: !s.enabled } : s)),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'toggle failed');
      } finally {
        setBusyKey(null);
      }
    },
    [api],
  );

  return (
    <section>
      <h3 style={heading}>Installed skills</h3>
      {error && <p style={{ color: '#ff9db0', fontSize: 14 }}>{error}</p>}
      {skills === null ? (
        <p style={muted}>Loading…</p>
      ) : skills.length === 0 ? (
        <p style={muted}>No skills installed in this deployment.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {skills.map((s) => (
            <div key={s.key} style={{ ...card, opacity: s.enabled ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <strong style={{ fontSize: 16 }}>{s.title ?? s.key}</strong>
                <span style={muted}>v{s.version}</span>
                <span style={s.enabled ? pillOn : pillOff}>{s.enabled ? 'enabled' : 'disabled'}</span>
                <button
                  style={s.enabled ? disableBtn : enableBtn}
                  disabled={busyKey === s.key}
                  onClick={() => void toggle(s)}
                >
                  {busyKey === s.key ? '…' : s.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
              {s.description && (
                <div style={{ color: '#c3cae0', fontSize: 14, marginTop: 6 }}>{s.description}</div>
              )}
              <div style={{ ...muted, marginTop: 8 }}>
                tools: {s.toolNames.join(', ') || '—'}
              </div>
              <div style={muted}>capabilities: {s.capabilities.join(', ') || '—'}</div>
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
const pillOn: React.CSSProperties = {
  fontSize: 11, background: '#16351f', color: '#5fd08a', padding: '2px 8px', borderRadius: 999,
};
const pillOff: React.CSSProperties = {
  fontSize: 11, background: '#3a2410', color: '#ffcf8b', padding: '2px 8px', borderRadius: 999,
};
const enableBtn: React.CSSProperties = {
  marginLeft: 'auto', background: '#2f7d4f', color: '#fff', border: 0, padding: '6px 14px',
  borderRadius: 8, cursor: 'pointer',
};
const disableBtn: React.CSSProperties = {
  marginLeft: 'auto', background: 'transparent', color: '#ffb3b3', border: '1px solid #43263a',
  padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
};
