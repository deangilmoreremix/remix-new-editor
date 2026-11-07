// [remix] Extra Element kinds for the Timeline Editor (not in CineGen): List Builder and Lead Generator.
// They sit beside Characters/Locations/Props/Vehicles in the Elements tab, reuse this repo's
// listBuilder addon (field types, defaults) and store saved configs in browser storage.
import { useEffect, useState } from 'react';
// @ts-expect-error plain JS addon from the main app
import { defaultListBuilder, FORM_FIELD_TYPES, fieldToken } from '../../../lib/editor/addons/listBuilder.js';

export type WebKind = 'list-builder' | 'lead-generator';
export interface WebKindItem { id: string; kind: WebKind; name: string; caption: string; fields: Array<{ id: number; label: string; token: string; type: string }>; tags: string[] }

export const WEB_KINDS: Array<{ id: WebKind; label: string }> = [
  { id: 'list-builder', label: 'List Builder' },
  { id: 'lead-generator', label: 'Lead Generator' },
];
const STORE = 'remix.cinegen.webKinds.v1';
const LEAD_FIELDS = [['First name', 'singleline'], ['Last name', 'singleline'], ['Email', 'email'], ['Phone', 'singleline'], ['Company', 'singleline'], ['Job title', 'singleline']];
const LEAD_TAGS = ['Hot Lead', 'Cold Lead', 'Follow Up', 'Qualified', 'Demo Scheduled', 'Customer'];

export function loadWebKinds(): WebKindItem[] {
  try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; }
}
function saveWebKinds(items: WebKindItem[]) { try { localStorage.setItem(STORE, JSON.stringify(items)); } catch { /* quota */ } }

export function newWebKind(kind: WebKind): WebKindItem {
  if (kind === 'lead-generator') {
    return { id: `wk-${Date.now().toString(36)}`, kind, name: 'New lead form', caption: 'Capture leads from your video', tags: ['Hot Lead'],
      fields: LEAD_FIELDS.map(([label, type], i) => ({ id: i, label, token: fieldToken(label), type })) };
  }
  const base = defaultListBuilder('list-builder');
  return { id: `wk-${Date.now().toString(36)}`, kind, name: 'New list', caption: base.caption.trim(), tags: [], fields: base.elements };
}

export function WebKindsPanel({ kind, editing, onEdit }: { kind: WebKind; editing: WebKindItem | null; onEdit: (item: WebKindItem | null) => void }) {
  const [items, setItems] = useState<WebKindItem[]>(loadWebKinds);
  useEffect(() => saveWebKinds(items), [items]);
  const shown = items.filter((i) => i.kind === kind);
  const save = (item: WebKindItem) => { setItems((all) => (all.some((a) => a.id === item.id) ? all.map((a) => (a.id === item.id ? item : a)) : [...all, item])); onEdit(null); };
  return (
    <>
      {shown.length === 0 ? (
        <div className="elements-tab__empty" style={{ padding: 40, color: 'var(--text-secondary)' }}>
          No {kind === 'list-builder' ? 'lists' : 'lead forms'} yet — use New Element to create one.
        </div>
      ) : (
        <div className="elements-tab__grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {shown.map((item) => (
            <button key={item.id} type="button" onClick={() => onEdit(item)} className="element-card" style={{ textAlign: 'left', padding: 16, border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-raised)', color: 'inherit', cursor: 'pointer' }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{item.name}</div>
              <span className="element-card__badge" style={{ display: 'inline-block', fontSize: 10, letterSpacing: '.08em', color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 6, padding: '2px 8px' }}>{kind === 'list-builder' ? 'LIST BUILDER' : 'LEAD GENERATOR'}</span>
              <span style={{ marginLeft: 8, color: 'var(--text-tertiary)', fontSize: 11 }}>{item.fields.length} fields</span>
              <div style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 12 }}>{item.fields.map((f) => f.label).join(' · ')}</div>
            </button>
          ))}
        </div>
      )}
      {editing && <WebKindModal item={editing} onSave={save} onClose={() => onEdit(null)} />}
    </>
  );
}

function WebKindModal({ item, onSave, onClose }: { item: WebKindItem; onSave: (i: WebKindItem) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(item);
  const set = (patch: Partial<WebKindItem>) => setDraft((d) => ({ ...d, ...patch }));
  const input = { background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', color: 'inherit', padding: '8px 10px', width: '100%' } as const;
  const label = { fontSize: 10, letterSpacing: '.12em', color: 'var(--text-tertiary)', margin: '12px 0 4px', display: 'block' } as const;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', zIndex: 50 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 560, maxHeight: '86vh', overflow: 'auto', background: 'var(--bg-raised)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', padding: 22 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{draft.kind === 'list-builder' ? 'List Builder' : 'Lead Generator'}</h2>
        <span style={label}>NAME</span>
        <input style={input} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        <span style={label}>CAPTION</span>
        <input style={input} value={draft.caption} onChange={(e) => set({ caption: e.target.value })} />
        <span style={label}>FIELDS</span>
        {draft.fields.map((f, i) => (
          <div key={f.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input style={input} value={f.label} onChange={(e) => set({ fields: draft.fields.map((x, j) => (j === i ? { ...x, label: e.target.value, token: fieldToken(e.target.value) } : x)) })} />
            <select style={{ ...input, width: 140 }} value={f.type} onChange={(e) => set({ fields: draft.fields.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })}>
              {(FORM_FIELD_TYPES as string[][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button type="button" onClick={() => set({ fields: draft.fields.filter((_, j) => j !== i) })} style={{ ...input, width: 36, cursor: 'pointer' }}>×</button>
          </div>
        ))}
        <button type="button" onClick={() => set({ fields: [...draft.fields, { id: Date.now(), label: 'Field', token: 'FIELD', type: 'singleline' }] })} style={{ ...input, width: 'auto', cursor: 'pointer', marginTop: 4 }}>+ Add field</button>
        {draft.kind === 'lead-generator' && (
          <>
            <span style={label}>LEAD TAGS</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {LEAD_TAGS.map((t) => {
                const on = draft.tags.includes(t);
                return <button key={t} type="button" onClick={() => set({ tags: on ? draft.tags.filter((x) => x !== t) : [...draft.tags, t] })} className={`elements-tab__filter ${on ? 'elements-tab__filter--active' : ''}`}>{t}</button>;
              })}
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ ...input, width: 'auto', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={() => onSave(draft)} style={{ marginLeft: 'auto', background: 'var(--accent)', color: '#041016', border: 0, borderRadius: 'var(--radius-md)', padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
        </div>
      </div>
    </div>
  );
}
