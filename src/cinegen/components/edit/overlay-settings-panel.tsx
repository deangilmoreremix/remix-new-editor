// [remix] Inspector for the selected overlay. The fields are drawn by the old editor's settings renderer (`renderAddonEditor`),
// so Lead Generator / List Builder / CTA have the same Basic / Style / Fields / Integrations tabs as before.
import { useEffect, useRef, type CSSProperties } from 'react';
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS settings renderer from the main app
import { renderAddonEditor } from '../../../lib/editor/addons/addonEditor.js';
// @ts-expect-error plain JS opt-in form schema + the Lead Generator clip adapter
import { applyOptinToLeadForm, switchListBuilderKind } from '../../../lib/editor/addons/listBuilder.js';
import type { MgPropField } from '@cinegen/lib/occ/mg-templates';
import { overlaySchema } from '@cinegen/lib/overlays/descriptors';
import { FormLeadsButton } from '@cinegen/components/leads/form-leads-button';
import { isRegistryOverlay } from '@cinegen/lib/overlays/overlays';
import { hyperframesItem, defaultFit } from '@cinegen/lib/hyperframes/overlay';
// @ts-expect-error plain JS placement helpers
import { HF_FITS, HF_FIT_LABELS, normalizeGeom, isReactItem } from '../../../lib/hyperframes/placement.js';

/** [remix] Props of an OpenChatCut motion-graphics template, drawn from the template's own propSchema. */
function MgPropsEditor({ overlay, onUpdate }: { overlay: OverlayClip; onUpdate: (u: Partial<OverlayClip>) => void }) {
  const schema = (overlay.propSchema as MgPropField[] | undefined) ?? [];
  const props = (overlay.props as Record<string, unknown>) ?? {};
  const set = (key: string, v: unknown) => onUpdate({ props: { ...props, [key]: v } });
  return (
    <div style={{ padding: '0 12px 16px' }}>
      {schema.map((f) => {
        const v = props[f.key] ?? f.defaultValue;
        const label = <span>{f.label ?? f.key}</span>;
        if (f.type === 'boolean') return <label key={f.key} className="addon-field"><span><input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} /> {f.label ?? f.key}</span></label>;
        if (f.type === 'color') return <label key={f.key} className="addon-field">{label}<input type="color" value={/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : '#ffffff'} onChange={(e) => set(f.key, e.target.value)} /></label>;
        if (f.type === 'number') return <label key={f.key} className="addon-field">{label}<input type="number" min={f.min} max={f.max} step={f.step ?? 1} value={Number(v ?? 0)} onChange={(e) => set(f.key, Number(e.target.value))} /></label>;
        if (f.type === 'select') return <label key={f.key} className="addon-field">{label}<select value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)}>{(f.options ?? []).map((o) => { const val = typeof o === 'string' ? o : o.value; return <option key={val} value={val}>{typeof o === 'string' ? o : o.label ?? o.value}</option>; })}</select></label>;
        return <label key={f.key} className="addon-field">{label}<input type="text" value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)} /></label>;
      })}
    </div>
  );
}

/** Placement of an animation in the frame: fit, offset, size. The same values are set by dragging on the video. */
function HfPlacementControls({ overlay, duration, onUpdate }: { overlay: OverlayClip; duration: number; onUpdate: (u: Partial<OverlayClip>) => void }) {
  const item = hyperframesItem(String(overlay.blockId ?? ''));
  const isRui = isReactItem(String(overlay.blockId ?? ''));
  const fitDefault = item && !isRui ? defaultFit(item) : 'contain';
  const g = normalizeGeom(overlay.geom, fitDefault) as { x: number; y: number; scale: number; fit: string };
  const set = (patch: Record<string, unknown>) => onUpdate({ geom: { ...((overlay.geom as Record<string, unknown>) ?? {}), fit: g.fit, ...patch } });
  const num = (v: string, d: number) => (Number.isFinite(Number(v)) && v.trim() !== '' ? Number(v) : d);
  const btn: CSSProperties = { fontSize: 11, padding: '5px 9px', borderRadius: 6, border: '1px solid var(--border-medium)', background: 'var(--bg-elevated)', color: 'inherit', cursor: 'pointer' };
  return (
    <div data-testid="hf-placement" style={{ padding: '0 12px 8px' }}>
      <div style={{ fontSize: 11, opacity: 0.7, margin: '4px 0 6px', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Placement</div>
      {!isRui && (
        <label className="addon-field"><span>Fit</span>
          <select aria-label="Fit" value={g.fit} onChange={(e) => set({ fit: e.target.value })}>{(HF_FITS as string[]).map((f) => <option key={f} value={f}>{(HF_FIT_LABELS as Record<string, string>)[f]}</option>)}</select>
        </label>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <label className="addon-field" style={{ flex: 1 }}><span>Left / right (%)</span><input aria-label="Left / right" type="number" step={1} value={Number(g.x.toFixed(1))} onChange={(e) => set({ x: num(e.target.value, g.x) })} /></label>
        <label className="addon-field" style={{ flex: 1 }}><span>Up / down (%)</span><input aria-label="Up / down" type="number" step={1} value={Number(g.y.toFixed(1))} onChange={(e) => set({ y: num(e.target.value, g.y) })} /></label>
        <label className="addon-field" style={{ flex: 1 }}><span>Size (%)</span><input aria-label="Size" type="number" min={10} max={400} step={5} value={Math.round(g.scale * 100)} onChange={(e) => set({ scale: Math.min(4, Math.max(0.1, num(e.target.value, 100) / 100)) })} /></label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button type="button" style={btn} onClick={() => onUpdate({ geom: { fit: fitDefault } })}>Reset position</button>
        <button type="button" style={btn} disabled={duration <= overlay.start + 0.5} onClick={() => onUpdate({ end: Math.max(overlay.start + 0.5, duration) })}>Extend to end of video</button>
      </div>
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>Tip: select it, then drag the "Move" handle on the video, or the corner square to resize.</div>
    </div>
  );
}

interface Props {
  overlay: OverlayClip;
  duration: number;
  onUpdate: (updates: Partial<OverlayClip>) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function OverlaySettingsPanel({ overlay, duration, onUpdate, onRemove, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef(overlay);
  latest.current = overlay;
  const editorRef = useRef<{ setOptions?: (o: Record<string, unknown>) => void } | null>(null);
  // true while a change came from this panel itself (so its own echo doesn't redraw the form under the caret)
  const ownEdit = useRef(false);

  useEffect(() => {
    if (!box.current || latest.current.type === 'mg-template' || latest.current.type === 'hyperframes') return;
    const schema = overlaySchema(latest.current);
    const editor = renderAddonEditor(box.current, {
      fields: schema.fields, fieldsFor: schema.fieldsFor, options: schema.options, onFieldChange: schema.onFieldChange, idPrefix: `ov-${overlay.id}`,
      onChange: (next: Record<string, unknown>) => {
        ownEdit.current = true;
        const cur = latest.current;
        if (cur.type === 'list-builder') {
          // Switching List Builder <-> Personalizer swaps in that kind's own defaults
          const curKind = (cur.config as { kind?: string } | undefined)?.kind ?? 'list-builder';
          if (next.kind && next.kind !== curKind) {
            const switched = switchListBuilderKind(next, next.kind);
            onUpdate({ config: switched });
            editor?.setOptions?.(switched);
            return;
          }
          onUpdate({ config: next });
        } else if (isRegistryOverlay(cur.type)) onUpdate({ addon: next });
        else if (cur.type === 'lead-form') {
          // the shared form options -> the flat Lead Generator clip the old editor saved (style / design are copied, never mutated)
          const clip = { ...cur, style: { ...((cur.style as object) ?? {}) }, design: { ...((cur.design as object) ?? {}) } } as Record<string, unknown>;
          applyOptinToLeadForm(clip, next);
          const { id: _id, type: _type, start: _start, end: _end, ...rest } = clip;
          void _id; void _type; void _start; void _end;
          onUpdate(rest as Partial<OverlayClip>);
        } else {
          const { id: _id, type: _type, start: _start, end: _end, ...rest } = next as Record<string, unknown>;
          void _id; void _type; void _start; void _end;
          onUpdate(rest as Partial<OverlayClip>);
        }
      },
    });
    editorRef.current = editor;
    return () => { editor?.destroy?.(); editorRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay.id]);

  // the form was edited by clicking its text: show the new text in the panel too
  useEffect(() => {
    if (ownEdit.current) { ownEdit.current = false; return; }
    if (!box.current || overlay.type === 'mg-template' || isRegistryOverlay(overlay.type)) return;
    editorRef.current?.setOptions?.(overlaySchema(overlay).options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay]);

  const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  return (
    <aside className="clip-properties-panel addon-panel" style={{ overflow: 'auto' }}>
      <style>{`
        .addon-panel .addon-tabs{display:flex;gap:6px;margin:6px 0 10px;flex-wrap:wrap}
        .addon-panel .addon-tab{border:1px solid var(--border-medium,rgba(255,255,255,.18));background:transparent;color:var(--text-secondary);border-radius:6px;padding:3px 9px;font-size:11px;cursor:pointer}
        .addon-panel .addon-tab.active{border-color:rgba(217,255,0,.25);color:#fff;background:rgba(217,255,0,.08)}
        .addon-panel .addon-field{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;font-size:11px;color:var(--text-secondary)}
        .addon-panel .addon-field input[type=text],.addon-panel .addon-field input[type=url],.addon-panel .addon-field textarea,.addon-panel .addon-field select{width:100%;box-sizing:border-box;background:var(--bg-raised,#10141c);color:var(--text-primary,#fff);border:1px solid var(--border-medium,rgba(255,255,255,.18));border-radius:6px;padding:6px 8px;font:inherit}
        .addon-panel .addon-fieldlist__row{display:flex;gap:4px;align-items:center;margin-bottom:4px}
        .addon-panel .mini-btn{border:1px solid var(--border-medium,rgba(255,255,255,.18));background:transparent;color:inherit;border-radius:6px;padding:2px 6px;cursor:pointer}
      `}</style>
      <div className="clip-properties-panel__header">
        <span className="clip-properties-panel__title" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{overlay.name} overlay</span>
        <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button type="button" className="mini-btn" onClick={onRemove}>Delete</button>
          <button type="button" className="mini-btn" onClick={onClose} aria-label="Close">✕</button>
        </span>
      </div>
      {(overlay.type === 'list-builder' || overlay.type === 'lead-form') && <FormLeadsButton overlayId={overlay.id} type={overlay.type} />}
      {overlay.type === 'list-builder' ? (
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 12px 8px' }}>Viewers fill this out before the video plays. It sits at the start of the timeline and takes no video time.</p>
      ) : (
      <div style={{ display: 'flex', gap: 8, padding: '0 12px 8px' }}>
        <label style={{ fontSize: 11 }}>Start (s)<br />
          <input type="number" min={0} max={Math.max(0, overlay.end - 0.5)} step={0.1} value={Number(overlay.start.toFixed(2))}
            onChange={(e) => onUpdate({ start: Math.max(0, Math.min(num(e.target.value, overlay.start), overlay.end - 0.5)) })} style={{ width: 80 }} />
        </label>
        <label style={{ fontSize: 11 }}>End (s)<br />
          <input type="number" min={overlay.start + 0.5} max={Math.max(duration, overlay.end)} step={0.1} value={Number(overlay.end.toFixed(2))}
            onChange={(e) => onUpdate({ end: Math.max(overlay.start + 0.5, num(e.target.value, overlay.end)) })} style={{ width: 80 }} />
        </label>
      </div>
      )}
      {overlay.type === 'hyperframes' && <HfPlacementControls overlay={overlay} duration={duration} onUpdate={onUpdate} />}
      {overlay.type === 'mg-template' || overlay.type === 'hyperframes' ? <MgPropsEditor overlay={overlay} onUpdate={onUpdate} /> : <div ref={box} style={{ padding: '0 12px 16px' }} />}
    </aside>
  );
}
