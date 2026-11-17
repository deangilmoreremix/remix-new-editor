// [remix] Stage 6: transition picker (search + categories + live preview thumbnails) and per-cut parameter controls
// for the vendored gl-transitions shaders. Used by the clip inspector's "Transition to next clip" section.
import { useMemo, useState } from 'react';
import { TransitionThumb } from '../../../openchatcut/library/TransitionThumb';
import { GLT_CATEGORIES, getGltEntry, gltDefaultParams, directionOf, directionVector, GLT_DIRECTIONS, gltLabel, isGltId, searchGlt, type GltDirection, type GltParam, type GltParams, type GltParamValue } from '../../../openchatcut/gl/glt';
import { hexToVec, sliderRange, vecToHex } from '../../../openchatcut/gl/glt/paramUi';

const CLASSIC = 'Classic';
const inputStyle = { background: 'var(--cg-surface-2, #0d1218)', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '3px 6px', fontSize: 12 } as const;

export interface PickerItem { id: string; label: string }

export function TransitionPicker({ value, classic, plugin, onPick }: { value?: string; classic: PickerItem[]; plugin: PickerItem[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const items = useMemo<PickerItem[]>(() => {
    const needle = q.trim().toLowerCase();
    const fits = (it: PickerItem) => !needle || it.label.toLowerCase().includes(needle) || it.id.toLowerCase().includes(needle);
    const out: PickerItem[] = [];
    if (!cat || cat === CLASSIC) out.push(...classic.filter(fits), ...plugin.filter(fits));
    if (!cat || cat !== CLASSIC) out.push(...searchGlt(q, cat).map((e) => ({ id: e.id, label: gltLabel(e.id) })));
    return out;
  }, [q, cat, classic, plugin]);
  const chip = (c: string | null, label: string) => (
    <button key={label} type="button" className={`library-panel__chip${cat === c ? ' library-panel__chip--on' : ''}`} data-testid={`tr-cat-${label}`} onClick={() => setCat(c)}>{label}</button>
  );
  return (
    <div data-testid="transition-picker" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input type="search" aria-label="Search transitions" placeholder={`Search ${classic.length + plugin.length + searchGlt('').length} transitions`} value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{[chip(null, 'All'), chip(CLASSIC, CLASSIC), ...GLT_CATEGORIES.map((c) => chip(c, c))]}</div>
      <div style={{ maxHeight: 240, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 6 }}>
        {items.length === 0 && <span style={{ fontSize: 11, opacity: 0.65, gridColumn: '1 / -1' }}>No transitions match.</span>}
        {items.map((it) => (
          <button key={it.id} type="button" title={getGltEntry(it.id)?.description ?? it.label} aria-pressed={value === it.id} data-testid={`tr-pick-${it.id}`}
            className={`cc-resource-card${hover === it.id ? ' hovered' : ''}`} style={value === it.id ? { borderColor: '#22d3ee' } : undefined}
            onMouseEnter={() => setHover(it.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(it.id)} onBlur={() => setHover(null)} onClick={() => onPick(it.id)}>
            <div className="cc-resource-thumb">{it.id.startsWith('plugin:') ? <span style={{ fontSize: 10, opacity: 0.6 }}>plugin</span> : <TransitionThumb type={it.id} playing={hover === it.id} />}</div>
            <span className="cc-resource-name">{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const rowStyle = { display: 'flex', alignItems: 'center', gap: 6, minHeight: 24 } as const;

function ParamControl({ p, value, onChange }: { p: GltParam; value: GltParamValue; onChange: (v: GltParamValue) => void }) {
  const label = <span className="clip-properties-panel__label" title={p.description} style={{ minWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>;
  if (p.type === 'bool') {
    return <label style={rowStyle}>{label}<input type="checkbox" aria-label={p.name} checked={!!value} onChange={(e) => onChange(e.target.checked)} /></label>;
  }
  if (p.type === 'float' || p.type === 'int') {
    const r = sliderRange(p); const n = typeof value === 'number' ? value : 0;
    return (
      <div style={rowStyle}>{label}
        <input type="range" aria-label={p.name} className="clip-properties-panel__slider" min={r.min} max={r.max} step={r.step} value={n} onChange={(e) => onChange(parseFloat(e.target.value))} />
        <span className="clip-properties-panel__value">{p.type === 'int' ? n : n.toFixed(2)}</span>
      </div>
    );
  }
  const vec = Array.isArray(value) ? value : (p.default as number[]);
  if (p.name === 'direction' && p.type === 'vec2') {
    const d = directionOf(vec) ?? '';
    return (
      <div style={rowStyle}>{label}
        <select aria-label="Direction" value={d} style={{ ...inputStyle, flex: 1 }} onChange={(e) => onChange(directionVector(e.target.value as GltDirection))}>
          {d === '' && <option value="">Custom</option>}
          {GLT_DIRECTIONS.map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
        </select>
      </div>
    );
  }
  if (p.color && (p.type === 'vec3' || p.type === 'vec4')) {
    return <div style={rowStyle}>{label}<input type="color" aria-label={p.name} value={vecToHex(vec)} onChange={(e) => onChange(hexToVec(e.target.value, vec))} /></div>;
  }
  return (
    <div style={rowStyle}>{label}
      {vec.map((c, i) => (
        <input key={i} type="number" aria-label={`${p.name} ${'xyzw'[i]}`} value={c} step={p.type === 'ivec2' ? 1 : 0.05} style={{ ...inputStyle, width: 52 }}
          onChange={(e) => { const x = parseFloat(e.target.value); if (Number.isFinite(x)) onChange(vec.map((o, j) => (j === i ? x : o))); }} />
      ))}
    </div>
  );
}

/** Controls for one cut's vendored shader. Only changed values are stored (`glParams`), so defaults stay defaults. */
export function TransitionParams({ id, params, onChange }: { id: string; params?: GltParams; onChange: (next: GltParams | undefined) => void }) {
  const entry = getGltEntry(id);
  if (!entry || !isGltId(id) || entry.params.length === 0) return null;
  const defaults = gltDefaultParams(id);
  const set = (name: string, v: GltParamValue) => {
    const next = { ...(params ?? {}), [name]: v };
    if (JSON.stringify(v) === JSON.stringify(defaults[name])) delete next[name];
    onChange(Object.keys(next).length ? next : undefined);
  };
  const dirty = !!params && Object.keys(params).length > 0;
  return (
    <div data-testid="transition-params" style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflow: 'auto' }}>
      {entry.params.map((p) => <ParamControl key={p.name} p={p} value={params?.[p.name] ?? p.default} onChange={(v) => set(p.name, v)} />)}
      {dirty && <button type="button" className="clip-properties-panel__toggle-btn" data-testid="transition-params-reset" onClick={() => onChange(undefined)}>Reset parameters</button>}
    </div>
  );
}
