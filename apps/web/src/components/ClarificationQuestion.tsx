import type React from 'react';
import { useState } from 'react';
import type { ClarificationChoice } from '../types';

interface Props {
  choices: ClarificationChoice[];
  busy: boolean;
  onSubmit: (selections: Record<string, { brand: string; unit?: string }>) => void;
}

function formatMinor(minor: number): string {
  return `₹${(minor / 100).toFixed(2)}`;
}

/** Batches every ambiguous item from one turn into a single question the user answers
 *  once, instead of asking per item — picks are collected and submitted together. */
export function ClarificationQuestion({ choices, busy, onSubmit }: Props) {
  const [picks, setPicks] = useState<Record<string, string>>({});

  const allAnswered = choices.every((c) => picks[c.productName]);

  const submit = () => {
    const selections: Record<string, { brand: string; unit?: string }> = {};
    for (const choice of choices) {
      const brand = picks[choice.productName];
      const option = choice.options.find((o) => o.brand === brand);
      if (option) selections[choice.productName] = { brand: option.brand, unit: option.unit };
    }
    onSubmit(selections);
  };

  return (
    <div style={panel}>
      <div style={heading}>A few of your items have more than one option — pick what you'd like:</div>
      {choices.map((choice) => (
        <div key={choice.productName} style={{ marginBottom: 10 }}>
          <div style={productLabel}>{choice.productName}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {choice.options.map((option) => {
              const selected = picks[choice.productName] === option.brand;
              return (
                <button
                  key={`${option.brand}-${option.storeKey}`}
                  type="button"
                  disabled={busy}
                  style={selected ? { ...optionBtn, ...optionBtnSelected } : optionBtn}
                  onClick={() => setPicks((p) => ({ ...p, [choice.productName]: option.brand }))}
                >
                  {option.brand} ({option.unit}) — {formatMinor(option.priceMinor)} at {option.storeKey}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button type="button" style={submitBtn} disabled={busy || !allAnswered} onClick={submit}>
        Confirm choices
      </button>
    </div>
  );
}

const panel: React.CSSProperties = {
  background: '#121826', border: '1px solid #1c2333', borderRadius: 10, padding: '12px 14px', margin: '8px 0',
};
const heading: React.CSSProperties = {
  color: '#ffcf8b', fontSize: 14, marginBottom: 10,
};
const productLabel: React.CSSProperties = {
  color: '#e6e9f2', fontSize: 14, marginBottom: 6, fontWeight: 600, textTransform: 'capitalize',
};
const optionBtn: React.CSSProperties = {
  background: '#0d1220', color: '#c3cae0', border: '1px solid #1c2333', borderRadius: 8,
  padding: '6px 12px', fontSize: 13, cursor: 'pointer',
};
const optionBtnSelected: React.CSSProperties = {
  background: '#2f4f9b', color: '#fff', borderColor: '#3a56d4',
};
const submitBtn: React.CSSProperties = {
  background: '#3a56d4', color: '#fff', border: 0, padding: '8px 16px', borderRadius: 8,
  cursor: 'pointer', marginTop: 4,
};
