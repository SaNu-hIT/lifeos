import type React from 'react';
import { useCallback, useState } from 'react';
import type { ApiClient } from '../lib/api';
import type { ClarificationChoice, PriceMatrix, SuggestedAction, TurnResult, TurnTrace } from '../types';
import { ClarificationQuestion } from './ClarificationQuestion';
import { PriceMatrixTable } from './PriceMatrixTable';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  priceMatrix?: PriceMatrix;
}

interface Pending {
  toolName: string;
  token: string;
  content: string;
}

interface PendingClarification {
  toolName: string;
  choices: ClarificationChoice[];
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
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingClarification, setPendingClarification] = useState<PendingClarification | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<TurnTrace | null>(null);

  const run = useCallback(
    async (
      content: string,
      confirmation?: { toolName: string; token: string },
      clarification?: { toolName: string; selections: Record<string, { brand: string; unit?: string }> },
    ) => {
      setBusy(true);
      setError(null);
      try {
        let id = conversationId;
        if (!id) {
          const started = await api.post<{ id: string }>('/v1/conversations', { title: 'Web chat' });
          id = started.id;
          setConversationId(id);
        }
        const result = await api.post<TurnResult>(`/v1/conversations/${id}/messages`, {
          content,
          ...(confirmation ? { confirmation } : {}),
          ...(clarification ? { clarification } : {}),
        });
        if (result.trace) setTrace(result.trace);
        if (result.status === 'awaiting_confirmation' && result.confirmation) {
          setPending({ ...result.confirmation, content });
          setPendingClarification(null);
          setSuggestions([]);
          setTurns((t) => [
            ...t,
            { role: 'assistant', content: `⚠️ This needs your confirmation to run ${result.confirmation!.toolName}.` },
          ]);
        } else if (result.status === 'awaiting_clarification' && result.clarification) {
          setPendingClarification({ ...result.clarification, content });
          setPending(null);
          setSuggestions([]);
        } else {
          setPending(null);
          setPendingClarification(null);
          setSuggestions(result.suggestedActions ?? []);
          setTurns((t) => [
            ...t,
            {
              role: 'assistant',
              content: result.assistantMessage?.content ?? '(no reply)',
              priceMatrix: result.assistantMessage?.priceMatrix,
            },
          ]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'send failed');
      } finally {
        setBusy(false);
      }
    },
    [api, conversationId],
  );

  const send = useCallback(() => {
    const content = input.trim();
    if (!content || busy) return;
    setInput('');
    setSuggestions([]);
    setTurns((t) => [...t, { role: 'user', content }]);
    void run(content);
  }, [busy, input, run]);

  // Tapping a suggested next step sends its prompt as if the user typed it.
  const sendSuggestion = useCallback(
    (action: SuggestedAction) => {
      if (busy) return;
      setSuggestions([]);
      setTurns((t) => [...t, { role: 'user', content: action.prompt }]);
      void run(action.prompt);
    },
    [busy, run],
  );

  const confirm = useCallback(() => {
    if (!pending || busy) return;
    const p = pending;
    setTurns((t) => [...t, { role: 'user', content: `✓ Confirm ${p.toolName}` }]);
    void run(p.content, { toolName: p.toolName, token: p.token });
  }, [busy, pending, run]);

  const answerClarification = useCallback(
    (selections: Record<string, { brand: string; unit?: string }>) => {
      if (!pendingClarification || busy) return;
      const pc = pendingClarification;
      const summary = Object.entries(selections)
        .map(([product, s]) => `${product}: ${s.brand}`)
        .join(', ');
      setTurns((t) => [...t, { role: 'user', content: `✓ ${summary}` }]);
      void run(pc.content, undefined, { toolName: pc.toolName, selections });
    },
    [busy, pendingClarification, run],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 10, alignContent: 'start' }}>
        {turns.length === 0 && (
          <p style={{ color: '#9aa4bf' }}>Ask LifeOS anything — e.g. “search for milk” or “place my order”.</p>
        )}
        {turns.map((t, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={bubble(t.role)}>{t.content}</div>
            {t.priceMatrix && (
              <div style={{ maxWidth: '95%' }}>
                <PriceMatrixTable matrix={t.priceMatrix} />
              </div>
            )}
          </div>
        ))}
        {busy && <div style={{ color: '#9aa4bf', fontSize: 14 }}>LifeOS is thinking…</div>}
      </div>

      {error && <div style={{ color: '#ff9db0', fontSize: 14, margin: '8px 0' }}>{error}</div>}

      {pending && !busy && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
          <span style={{ color: '#ffcf8b', fontSize: 14 }}>Confirm {pending.toolName}?</span>
          <button style={confirmBtn} onClick={confirm}>Confirm</button>
          <button style={cancelBtn} onClick={() => setPending(null)}>Cancel</button>
        </div>
      )}

      {pendingClarification && (
        <ClarificationQuestion
          choices={pendingClarification.choices}
          busy={busy}
          onSubmit={answerClarification}
        />
      )}

      {suggestions.length > 0 && !pending && !pendingClarification && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
          {suggestions.map((s) =>
            s.url ? (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                style={{ ...suggestionBtn, textDecoration: 'none', display: 'inline-block' }}
              >
                {s.label}
              </a>
            ) : (
              <button
                key={s.label}
                type="button"
                style={suggestionBtn}
                disabled={busy}
                onClick={() => sendSuggestion(s)}
              >
                {s.label}
              </button>
            ),
          )}
        </div>
      )}

      <form
        style={{ display: 'flex', gap: 8, marginTop: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          send();
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

      <TraceLog trace={trace} />
    </div>
  );
}

function TraceLog({ trace }: { trace: TurnTrace | null }) {
  if (!trace) return null;
  const line = (color: string, label: string, body: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 8, padding: '3px 0' }}>
      <span style={{ color, minWidth: 84 }}>{label}</span>
      <span style={{ color: '#c3cae0' }}>{body}</span>
    </div>
  );
  return (
    <div style={logPanel}>
      <div style={logHeader}>Execution log — last turn</div>
      {line('#7c9cff', 'context', `scope “${trace.scope}” · ${trace.capabilities.length} capabilities`)}
      {line(
        '#7c9cff',
        'tools',
        trace.availableTools.length
          ? trace.availableTools.join(', ')
          : '⚠️ none available (no matching capability — the planner has nothing to call)',
      )}
      {line(
        '#a586ff',
        'planner',
        trace.plan.length
          ? trace.plan.map((p) => `${p.tool}(${JSON.stringify(p.args)})`).join('  →  ')
          : 'no tool selected (conversational)',
      )}
      {trace.steps.length > 0 &&
        line(
          '#5fd08a',
          'execute',
          <span>
            {trace.steps.map((s, i) => (
              <span key={i} style={{ marginRight: 10 }}>
                {s.status === 'ok' ? '✓' : s.status === 'error' ? '⚠️' : '⏸'} {s.tool}
                {s.error ? ` (${s.error.message})` : ''}
              </span>
            ))}
          </span>,
        )}
    </div>
  );
}

function bubble(role: 'user' | 'assistant'): React.CSSProperties {
  return {
    maxWidth: '75%', padding: '10px 14px', borderRadius: 14, fontSize: 15,
    background: role === 'user' ? '#3a56d4' : '#121826',
    border: role === 'user' ? 0 : '1px solid #1c2333',
    color: '#fff', whiteSpace: 'pre-wrap',
  };
}

const inputStyle: React.CSSProperties = {
  flex: 1, background: '#121826', border: '1px solid #1c2333', color: '#e6e9f2',
  borderRadius: 10, padding: '12px 14px', fontSize: 15,
};
const sendBtn: React.CSSProperties = {
  background: '#3a56d4', color: '#fff', border: 0, padding: '0 20px', borderRadius: 10, cursor: 'pointer',
};
const confirmBtn: React.CSSProperties = {
  background: '#2f7d4f', color: '#fff', border: 0, padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
};
const cancelBtn: React.CSSProperties = {
  background: 'transparent', color: '#9aa4bf', border: '1px solid #1c2333', padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
};
const suggestionBtn: React.CSSProperties = {
  background: '#121826', color: '#7c9cff', border: '1px solid #2a3350', borderRadius: 999,
  padding: '7px 14px', fontSize: 13.5, cursor: 'pointer',
};
const logPanel: React.CSSProperties = {
  marginTop: 12, background: '#0d1220', border: '1px solid #1c2333', borderRadius: 10,
  padding: '10px 14px', fontFamily: 'ui-monospace, monospace', fontSize: 12.5,
};
const logHeader: React.CSSProperties = {
  color: '#9aa4bf', textTransform: 'uppercase', letterSpacing: 1, fontSize: 11, marginBottom: 6,
};
