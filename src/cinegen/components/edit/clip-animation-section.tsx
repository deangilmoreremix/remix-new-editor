// [remix] Stage 2: Animation section of the clip inspector - unified keyframes for position, scale, rotation, opacity, crop and effect parameters,
// auto-keyframe toggle, dopesheet, graph (curve) editor and procedural motion modifiers (drift, sway, breathing, spin, shake).
import { useMemo, useRef, useState } from 'react';
import type { Clip } from '@cinegen/types/timeline';
import { clipEffectiveDuration } from '@cinegen/types/timeline';
import { ALL_FX } from '../../../openchatcut/gl/fx/effects';
import { ANIM_PROPS, fxPropId, moveKey, parseFxPropId, removeKey, clearProp, setKeyEase, unifyLegacy, type ClipAnim } from '@cinegen/lib/editor/stage2/anim';
import { editProps, readProp, type ClipPatch } from '@cinegen/lib/editor/stage2/prop-edit';
import { createModifier, MODIFIER_LABELS, MODIFIER_TYPES, type ModifierType } from '@cinegen/lib/editor/stage2/modifiers';
import { setAutoKey, useAutoKey } from '@cinegen/lib/editor/stage2/auto-key-store';
import { generateId } from '@cinegen/lib/utils/ids';
import { CurveEditor } from './curve-editor';
import { Dopesheet, type KeySel } from './dopesheet';

const selectStyle = { width: '100%' } as const;

export function ClipAnimationSection({ clip, currentTime = 0, onUpdate, onSeek }: { clip: Clip; currentTime?: number; onUpdate: (u: ClipPatch) => void; onSeek?: (time: number) => void }) {
  const auto = useAutoKey();
  const [sheet, setSheet] = useState(false);
  const [sel, setSel] = useState<KeySel | null>(null);
  const [curve, setCurve] = useState(false);
  const latest = useRef(clip); latest.current = clip;
  const dur = clipEffectiveDuration(clip);
  const t = Math.max(0, Math.min(currentTime - clip.startTime, dur));
  // what the inspector shows: the unified store, with any older keys of this clip folded in (nothing is written until an edit)
  const view = useMemo(() => { const u = unifyLegacy(clip); return { u, anim: u.anim ?? clip.anim }; }, [clip]);
  const anim = view.anim;
  const keysOf = (id: string) => anim?.keys?.[id] ?? [];
  const commitAnim = (c: Clip, next: ClipAnim | undefined) => { const u = unifyLegacy(c); onUpdate({ ...('transform' in u ? { transform: u.transform } : {}), ...(u.keyframes ? { keyframes: u.keyframes } : {}), anim: next }); };
  // clear one property's keys but keep its value at the playhead as the static value
  const clearFor = (id: string, dflt: number) => {
    const c = { ...latest.current, ...unifyLegacy(latest.current) } as Clip;
    const cur = readProp(c, id, t, dflt);
    const base = { ...c, anim: clearProp(c.anim, id) } as Clip;
    onUpdate({ anim: base.anim, transform: base.transform, keyframes: base.keyframes, ...editProps(base, { [id]: cur }, t, false) });
    setSel(null);
  };

  const set = (id: string, v: number, forceKey = false) => onUpdate(editProps(clip, { [id]: v }, t, auto || forceKey));
  const fxRows = useMemo(() => {
    const ids = new Set<string>(Object.keys(anim?.keys ?? {}).filter((k) => parseFxPropId(k)));
    return [...ids].map((id) => { const p = parseFxPropId(id)!; const def = ALL_FX[clip.fx?.[p.index]?.id ?? '']; const pd = def?.props.find((q) => q.key === p.key && q.kind !== 'color') as { label: string; min: number; max: number; step?: number; default: number } | undefined; return { id, label: `${def?.name ?? `Effect ${p.index + 1}`} · ${pd?.label ?? p.key}`, min: pd?.min ?? 0, max: pd?.max ?? 1, step: pd?.step ?? 0.01, dflt: pd?.default ?? 0 }; });
  }, [anim, clip.fx]);
  const addableFx = (clip.fx ?? []).flatMap((f, i) => (ALL_FX[f.id] && f.enabled !== false ? ALL_FX[f.id].props.filter((p) => p.kind !== 'color').map((p) => ({ id: fxPropId(i, p.key), label: `${ALL_FX[f.id].name} · ${p.label}` })) : [])).filter((o) => !keysOf(o.id).length);

  const row = (r: { id: string; label: string; min: number; max: number; step: number; dflt: number; unit?: string }) => {
    const list = keysOf(r.id);
    const v = readProp(clip, r.id, t, r.dflt);
    const atKey = list.some((k) => Math.abs(k.t - t) <= 0.02);
    return (
      <div className="clip-properties-panel__row" key={r.id}>
        <span className="clip-properties-panel__label">{r.label}</span>
        <input type="range" className="clip-properties-panel__slider" data-testid={`anim-${r.id}`} aria-label={r.label} min={r.min} max={r.max} step={r.step} value={v} onChange={(e) => set(r.id, parseFloat(e.target.value))} />
        <span className="clip-properties-panel__value">{v.toFixed(r.step < 0.01 ? 3 : 2)}{r.unit ?? ''}</span>
        <button className="clip-properties-panel__toggle-btn" data-testid={`anim-key-${r.id}`} aria-label={`${atKey ? 'Update' : 'Add'} keyframe for ${r.label}`} title={atKey ? 'Update the keyframe at the playhead' : 'Add a keyframe at the playhead'} style={{ padding: '0 5px', color: list.length ? '#22d3ee' : undefined }} onClick={() => set(r.id, v, true)}>{atKey ? '◆' : '◇'}</button>
        {list.length > 0 && <button className="clip-properties-panel__toggle-btn" aria-label={`Clear keyframes for ${r.label}`} title="Clear this property's keyframes (keeps the value at the playhead)" style={{ padding: '0 5px' }} onClick={() => clearFor(r.id, r.dflt)}>✕</button>}
      </div>
    );
  };

  const selKey = sel ? keysOf(sel.prop)[sel.index] : undefined;
  const mods = anim?.modifiers ?? [];
  const setMods = (next: NonNullable<ClipAnim['modifiers']>) => { const { modifiers: _drop, ...rest } = clip.anim ?? {}; const merged: ClipAnim = { ...rest, ...(next.length ? { modifiers: next } : {}) }; onUpdate({ anim: merged.keys || merged.modifiers ? merged : undefined }); };
  const patchMod = (id: string, patch: Partial<(typeof mods)[number]>) => setMods(mods.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  return (
    <div className="clip-properties-panel__section" data-testid="clip-animation" style={{ position: 'relative' }}>
      <div className="clip-properties-panel__section-title">Animation</div>
      <div className="clip-properties-panel__row">
        <button className="clip-properties-panel__toggle-btn" data-testid="auto-key" aria-pressed={auto} title="While on, changing a property records a keyframe at the playhead" style={auto ? { borderColor: '#ef4444', color: '#ef4444' } : undefined} onClick={() => setAutoKey(!auto)}>{auto ? '● Auto-key: on' : '○ Auto-key: off'}</button>
        <button className="clip-properties-panel__toggle-btn" data-testid="dopesheet-toggle" aria-pressed={sheet} onClick={() => setSheet(!sheet)}>{sheet ? 'Hide dopesheet' : 'Dopesheet'}</button>
      </div>
      {ANIM_PROPS.filter((p) => !p.id.startsWith('crop')).map((p) => row({ ...p, dflt: p.default }))}
      <details>
        <summary style={{ fontSize: 11, cursor: 'pointer', margin: '4px 0' }}>Animated crop</summary>
        {ANIM_PROPS.filter((p) => p.id.startsWith('crop')).map((p) => row({ ...p, dflt: p.default }))}
      </details>
      {fxRows.map((r) => row(r))}
      {addableFx.length > 0 && (
        <div className="clip-properties-panel__row">
          <select aria-label="Animate an effect parameter" data-testid="anim-add-fx" className="clip-properties-panel__select" style={selectStyle} value="" onChange={(e) => { if (e.target.value) { const p = parseFxPropId(e.target.value)!; const def = ALL_FX[clip.fx![p.index].id]; const pd = def.props.find((q) => q.key === p.key); set(e.target.value, readProp(clip, e.target.value, t, typeof pd?.default === 'number' ? pd.default : 0), true); } }}>
            <option value="">+ Animate effect parameter…</option>
            {addableFx.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      )}
      {sheet && (
        <Dopesheet anim={anim} duration={dur} time={t} selected={sel} onSelect={setSel} onSeek={(s) => onSeek?.(clip.startTime + s)}
          onMove={(prop, index, nt) => { const c = latest.current; const a = unifyLegacy(c).anim ?? c.anim; const moved = moveKey(a, prop, index, nt); commitAnim(c, moved); const ni = (moved?.keys?.[prop] ?? []).findIndex((k) => Math.abs(k.t - Math.max(0, nt)) < 1e-3); if (ni >= 0) setSel({ prop, index: ni }); return ni >= 0 ? ni : index; }} />
      )}
      {selKey && (
        <div className="clip-properties-panel__row" data-testid="key-actions">
          <span style={{ fontSize: 11, flex: 1 }}>Key {sel!.index + 1} at {selKey.t.toFixed(2)}s</span>
          <button className="clip-properties-panel__toggle-btn" data-testid="curve-open" aria-expanded={curve} onClick={() => setCurve(!curve)}>Curve…</button>
          <button className="clip-properties-panel__toggle-btn" data-testid="key-delete" onClick={() => { commitAnim(clip, removeKey(unifyLegacy(clip).anim ?? clip.anim, sel!.prop, sel!.index)); setSel(null); setCurve(false); }}>Delete key</button>
        </div>
      )}
      {selKey && curve && <CurveEditor ease={selKey.ease} onClose={() => setCurve(false)} onChange={(e) => commitAnim(latest.current, setKeyEase(unifyLegacy(latest.current).anim ?? latest.current.anim, sel!.prop, sel!.index, e))} />}

      <div className="clip-properties-panel__section-title" style={{ marginTop: 8 }}>Motion modifiers</div>
      {mods.map((m) => (
        <div key={m.id} data-testid={`modifier-${m.type}`} style={{ marginBottom: 6 }}>
          <div className="clip-properties-panel__row">
            <span style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{MODIFIER_LABELS[m.type]}</span>
            <button className="clip-properties-panel__toggle-btn" aria-label={`${m.enabled ? 'Disable' : 'Enable'} ${MODIFIER_LABELS[m.type]}`} onClick={() => patchMod(m.id, { enabled: !m.enabled })}>{m.enabled ? 'On' : 'Off'}</button>
            <button className="clip-properties-panel__toggle-btn" aria-label={`Remove ${MODIFIER_LABELS[m.type]}`} onClick={() => setMods(mods.filter((x) => x.id !== m.id))}>×</button>
          </div>
          <div className="clip-properties-panel__row"><span className="clip-properties-panel__label">Intensity</span>
            <input type="range" className="clip-properties-panel__slider" aria-label={`${MODIFIER_LABELS[m.type]} intensity`} min={0} max={2} step={0.05} value={m.amplitude} onChange={(e) => patchMod(m.id, { amplitude: parseFloat(e.target.value) })} />
            <span className="clip-properties-panel__value">{m.amplitude.toFixed(2)}</span></div>
          <div className="clip-properties-panel__row"><span className="clip-properties-panel__label">{m.type === 'spin' ? 'Turns/s' : 'Speed (Hz)'}</span>
            <input type="range" className="clip-properties-panel__slider" aria-label={`${MODIFIER_LABELS[m.type]} speed`} min={0.05} max={m.type === 'shake' ? 20 : 3} step={0.05} value={m.frequency} onChange={(e) => patchMod(m.id, { frequency: parseFloat(e.target.value) })} />
            <span className="clip-properties-panel__value">{m.frequency.toFixed(2)}</span></div>
          {m.type === 'shake' && <div className="clip-properties-panel__row"><span className="clip-properties-panel__label">Seed</span>
            <input type="number" aria-label="Shake seed" min={1} max={9999} step={1} value={m.seed} style={{ width: 64 }} onChange={(e) => patchMod(m.id, { seed: Math.max(1, Math.round(Number(e.target.value) || 1)) })} /></div>}
        </div>
      ))}
      <div className="clip-properties-panel__row">
        <select aria-label="Add motion modifier" data-testid="modifier-add" className="clip-properties-panel__select" style={selectStyle} value="" onChange={(e) => { if (e.target.value) setMods([...mods, createModifier(e.target.value as ModifierType, { id: generateId(), seed: mods.length + 1 })]); }}>
          <option value="">+ Add motion (non-destructive)…</option>
          {MODIFIER_TYPES.map((k) => <option key={k} value={k}>{MODIFIER_LABELS[k]}</option>)}
        </select>
      </div>
    </div>
  );
}
