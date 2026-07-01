import type React from 'react';
import { useCallback, useState } from 'react';
import type { ApiClient } from '../lib/api';
import type { TurnResult } from '../types';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  api: ApiClient;
}

export function Chat({ api }: Props) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    const content = input.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    setInput('');
    setTurns((t) => [...t, { role: 'user', content }]);
    try {
      let id = conversationId;
      if (!id) {
        const started = await api.post<{ id: string }>('/v1/conversations', { title: 'Web chat' });
        id = started.id;
        setConversationId(id);
      }
      const result = await api.post<TurnResult>(`/v1/conversations/${id}/messages`, { content });
      setTurns((t) => [...t, { role: 'assistant', content: result.reply ?? '(no reply)' }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'send failed');
    } finally {
      setBusy(false);
    }
  }, [api, busy, conversationId, input]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 10, alignContent: 'start' }}>
        {turns.length === 0 && <p style={{ color: '#9aa4bf' }}>Ask LifeOS anything — e.g. “order my usual groceries”.</p>}
        {turns.map((t, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={bubble(t.role)}>{t.content}</div>
          </div>
        ))}
        {busy && <div style={{ color: '#9aa4bf', fontSize: 14 }}>LifeOS is thinking…</div>}
      </div>

      {error && <div style={{ color: '#ff9db0', fontSize: 14, margin: '8px 0' }}>{error}</div>}

      <form
        style={{ display: 'flex', gap: 8, marginTop: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          style={inputStyle}
          value={input}
          placeholder="Message LifeOS…"
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" style={sendBtn} disabled={busy}>Send</button>
      </form>
    </div>
  );
}

function bubble(role: 'user' | 'assistant'): React.CSSProperties {
  return {
    maxWidth: '75%', padding: '10px 14px', borderRadius: 14, fontSize: 15,
    background: role === 'user' ? '#3a56d4' : '#121826',
    border: role === 'user' ? 0 : '1px solid #1c2333',
    color: '#fff',
  };
}

const inputStyle: React.CSSProperties = {
  flex: 1, background: '#121826', border: '1px solid #1c2333', color: '#e6e9f2',
  borderRadius: 10, padding: '12px 14px', fontSize: 15,
};
const sendBtn: React.CSSProperties = {
  background: '#3a56d4', color: '#fff', border: 0, padding: '0 20px', borderRadius: 10, cursor: 'pointer',
};
