import React from 'react';

/**
 * Editor for a dropdown's choices: one box per choice with add, remove and move buttons.
 * Stored as one text value, one choice per line (older pages stored them comma separated, which still reads fine).
 */
export const parseChoices = (v) => String(v || '').split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean).slice(0, 30);

const box = { display: 'flex', gap: 4, marginBottom: 4 };
const input = { flex: 1, minWidth: 0, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', font: 'inherit' };
const btn = { padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', font: 'inherit' };

export function choicesField(label = 'Dropdown choices') {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange, name }) => {
      const raw = String(value || '');
      const items = raw.includes('\n') ? raw.split('\n') : parseChoices(raw);
      const list = items.length ? items : [''];
      const save = (next) => onChange(next.slice(0, 30).join('\n'));
      const set = (i, v) => save(list.map((x, k) => (k === i ? v : x)));
      const move = (i, d) => { const j = i + d; if (j < 0 || j >= list.length) return; const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; save(next); };
      return (
        <div>
          <label htmlFor={`${name}-0`} style={{ display: 'block', fontSize: 12, fontWeight: 600, margin: '0 0 4px' }}>{label}</label>
          {list.map((c, i) => (
            <div key={i} style={box}>
              <input id={`${name}-${i}`} style={input} value={c} placeholder={`Choice ${i + 1}`} maxLength={80} onChange={(e) => set(i, e.target.value)} aria-label={`${label} ${i + 1}`} />
              <button type="button" style={btn} onClick={() => move(i, -1)} aria-label={`Move choice ${i + 1} up`} disabled={i === 0}>↑</button>
              <button type="button" style={btn} onClick={() => move(i, 1)} aria-label={`Move choice ${i + 1} down`} disabled={i === list.length - 1}>↓</button>
              <button type="button" style={btn} onClick={() => save(list.filter((_, k) => k !== i))} aria-label={`Remove choice ${i + 1}`}>✕</button>
            </div>
          ))}
          <button type="button" style={btn} onClick={() => save([...list, ''])} disabled={list.length >= 30}>+ Add a choice</button>
        </div>
      );
    },
  };
}
