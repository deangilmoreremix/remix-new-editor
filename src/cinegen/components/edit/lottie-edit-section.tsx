// [remix] Stage 2 (+ Stage 11: value slots, layer visibility): colour / text / speed customisation of a Lottie sticker. The edits are saved in the overlay's options (lottieColors, lottieTexts,
// lottieSpeed) and applied to the animation JSON by the same pure patcher in the editor preview (lottie-web) and the Remotion export (@remotion/lottie).
import { useEffect, useState } from 'react';
import { extractLottieColorLayers, extractLottieTextLayers, type LottieColorLayer, type LottieTextLayer } from '@cinegen/lib/editor/stage2/lottie-edit';
import { extractLottieLayers, extractLottieValueSlots, type LottieLayerInfo, type LottieValueSlot, type LottieSlotValue } from '@cinegen/lib/editor/stage11/lottie-extra'; // [remix] Stage 11

type Opts = { src?: string; kind?: string; lottieColors?: Record<string, string>; lottieTexts?: Record<string, string>; lottieSpeed?: number; lottieValues?: Record<string, LottieSlotValue>; lottieHidden?: string[] };

export function LottieEditSection({ addon, onChange }: { addon: Opts; onChange: (next: Opts) => void }) {
  const [state, setState] = useState<{ colors: LottieColorLayer[]; texts: LottieTextLayer[]; layers: LottieLayerInfo[]; slots: LottieValueSlot[]; error?: string } | null>(null);
  useEffect(() => {
    let live = true;
    setState(null);
    if (!addon.src) return;
    fetch(addon.src).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).then((json) => {
      if (live) setState({ colors: extractLottieColorLayers(json), texts: extractLottieTextLayers(json), layers: extractLottieLayers(json), slots: extractLottieValueSlots(json) });
    }).catch((e) => { if (live) setState({ colors: [], texts: [], layers: [], slots: [], error: e instanceof Error ? e.message : String(e) }); });
    return () => { live = false; };
  }, [addon.src]);
  const colors = addon.lottieColors ?? {}; const texts = addon.lottieTexts ?? {};
  const setMap = (field: 'lottieColors' | 'lottieTexts', key: string, value: string | undefined) => {
    const cur = { ...((addon[field] as Record<string, string> | undefined) ?? {}) };
    if (value === undefined) delete cur[key]; else cur[key] = value;
    onChange({ ...addon, [field]: Object.keys(cur).length ? cur : undefined });
  };
  const label = { fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 } as const;
  return (
    <div data-testid="lottie-edit" style={{ padding: '0 12px 12px' }}>
      <div style={{ fontSize: 11, opacity: 0.7, margin: '4px 0 6px', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Lottie customise</div>
      {!state && <div style={{ fontSize: 11, opacity: 0.7 }}>Loading animation…</div>}
      {state?.error && <div style={{ fontSize: 11, color: '#f87171' }}>Could not read the animation: {state.error}</div>}
      {state && state.colors.length === 0 && state.texts.length === 0 && state.layers.length === 0 && !state.error && <div style={{ fontSize: 11, opacity: 0.7 }}>No editable fill/stroke colours or text layers in this animation.</div>}
      {state?.colors.map((c) => (
        <label key={c.key} style={label}>
          <input type="color" aria-label={`Colour ${c.label}`} data-testid={`lottie-color-${c.key}`} value={colors[c.key] ?? c.color} onChange={(e) => setMap('lottieColors', c.key, e.target.value)} />
          <span style={{ flex: 1 }}>{c.label}</span>
          {colors[c.key] && <button type="button" className="mini-btn" aria-label={`Reset ${c.label}`} onClick={() => setMap('lottieColors', c.key, undefined)}>reset</button>}
        </label>
      ))}
      {state?.texts.map((x) => (
        <label key={x.key} style={{ ...label, flexDirection: 'column', alignItems: 'stretch' }}>
          <span>{x.label}</span>
          <input type="text" aria-label={`Text ${x.label}`} data-testid={`lottie-text-${x.key}`} value={texts[x.key] ?? x.text} onChange={(e) => setMap('lottieTexts', x.key, e.target.value)} />
        </label>
      ))}
      {state?.slots.map((sl) => {
        const cur = addon.lottieValues?.[sl.id] ?? sl.value;
        const setVal = (v: LottieSlotValue | undefined) => { const m = { ...(addon.lottieValues ?? {}) }; if (v === undefined) delete m[sl.id]; else m[sl.id] = v; onChange({ ...addon, lottieValues: Object.keys(m).length ? m : undefined }); };
        return (
          <div key={sl.id} style={label} data-testid={`lottie-slot-${sl.id}`}>
            <span style={{ flex: 1 }}>{sl.label}</span>
            {sl.type === 'scalar'
              ? <input type="number" aria-label={`Value ${sl.label}`} style={{ width: 70 }} value={cur as number} onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) setVal(v); }} />
              : (['x', 'y'] as const).map((ax, i) => <input key={ax} type="number" aria-label={`Value ${sl.label} ${ax}`} style={{ width: 56 }} value={(cur as [number, number])[i]} onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { const next: [number, number] = [...(cur as [number, number])] as [number, number]; next[i] = v; setVal(next); } }} />)}
            {addon.lottieValues?.[sl.id] !== undefined && <button type="button" className="mini-btn" aria-label={`Reset ${sl.label}`} onClick={() => setVal(undefined)}>reset</button>}
          </div>
        );
      })}
      {state && state.layers.length > 0 && (
        <details data-testid="lottie-layers" style={{ margin: '4px 0 6px' }}>
          <summary style={{ fontSize: 11, cursor: 'pointer' }}>Layers ({state.layers.length}){(addon.lottieHidden?.length ?? 0) > 0 ? `, ${addon.lottieHidden!.length} hidden` : ''}</summary>
          {state.layers.slice(0, 60).map((l) => {
            const hidden = l.hidden || (addon.lottieHidden ?? []).includes(l.key);
            return (
              <label key={l.key} style={label}>
                <input type="checkbox" aria-label={`Show layer ${l.label}`} data-testid={`lottie-layer-${l.key}`} checked={!hidden} disabled={l.hidden} onChange={(e) => {
                  const cur = new Set(addon.lottieHidden ?? []);
                  if (e.target.checked) cur.delete(l.key); else cur.add(l.key);
                  onChange({ ...addon, lottieHidden: cur.size ? [...cur] : undefined });
                }} />
                <span style={{ flex: 1 }}>{l.label} <span style={{ opacity: 0.55 }}>({l.kind})</span></span>
              </label>
            );
          })}
        </details>
      )}
      <label style={label}><span style={{ width: 70 }}>Speed</span>
        <input type="range" aria-label="Lottie speed" min={0.25} max={3} step={0.05} value={addon.lottieSpeed ?? 1} onChange={(e) => onChange({ ...addon, lottieSpeed: parseFloat(e.target.value) })} />
        <span>{(addon.lottieSpeed ?? 1).toFixed(2)}×</span>
      </label>
    </div>
  );
}
