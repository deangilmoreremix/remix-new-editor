// [remix] The Overlays lane under the timeline ruler: one block per overlay (Lead Generator, List Builder, CTA). Drag a block to
// move it, drag its edges to trim, click to select (opens its settings), and add new ones at the playhead from the lane header.
import { useRef } from 'react';
import type { OverlayClip, OverlayKind } from '@cinegen/types/workspace';
import { OVERLAY_KINDS, overlayTemplates, isGateOverlay } from '@cinegen/lib/overlays/overlays';
import { selectOverlay, useSelectedOverlay } from '@cinegen/lib/overlays/selection';

interface Props {
  overlays: OverlayClip[];
  pxPerSecond: number;
  scrollLeft: number;
  labelWidth: number;
  sequenceDuration: number;
  onAdd: (kind: OverlayKind) => void;
  /** End Screen / Connect Form template (adds several overlays) */
  onAddTemplate?: (templateId: string) => void;
  onBrowseMotion?: () => void;
  /** [hyperframes] only passed when the HyperFrames feature flag is on */
  onBrowseHyperframes?: () => void;
  onOpenSpeech?: () => void;
  onOpenGenerator?: () => void;
  onOpenPersonalization?: () => void;
  onUpdate: (id: string, updates: Partial<OverlayClip>) => void;
  /** Remove an overlay from the timeline (the × on its block, or Delete / Backspace while it is selected). */
  onRemove: (id: string) => void;
}

const MIN = 0.5;

export function OverlayLane({ overlays, pxPerSecond, scrollLeft, labelWidth, sequenceDuration, onAdd, onAddTemplate, onBrowseMotion, onBrowseHyperframes, onOpenSpeech, onOpenGenerator, onOpenPersonalization, onUpdate, onRemove }: Props) {
  const selected = useSelectedOverlay();
  const drag = useRef<{ id: string; mode: 'move' | 'start' | 'end'; x: number; start: number; end: number } | null>(null);

  const begin = (e: React.PointerEvent, o: OverlayClip, mode: 'move' | 'start' | 'end') => {
    e.stopPropagation();
    selectOverlay(o.id);
    (e.currentTarget as HTMLElement).focus?.(); // so Delete / Backspace act on this block
    if (isGateOverlay(o)) return; // the List Builder is a gate locked at 0s
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: o.id, mode, x: e.clientX, start: o.start, end: o.end };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dt = (e.clientX - d.x) / pxPerSecond;
    if (d.mode === 'move') {
      const len = d.end - d.start;
      const start = Math.max(0, d.start + dt);
      onUpdate(d.id, { start, end: start + len });
    } else if (d.mode === 'start') onUpdate(d.id, { start: Math.max(0, Math.min(d.start + dt, d.end - MIN)) });
    else onUpdate(d.id, { end: Math.max(d.start + MIN, d.end + dt) });
  };
  const end = () => { drag.current = null; };

  return (
    <div className="overlay-lane" style={{ display: 'flex', height: 30, borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,.08))', background: 'var(--bg-surface, #0b0e14)', flex: '0 0 auto' }}>
      <div title="Overlays: forms and buttons drawn over the video" style={{ width: labelWidth, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 3, padding: '0 6px', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        <select aria-label="Add overlay" title="Add an overlay at the playhead" value="" onChange={(e) => { if (!e.target.value) return; if (e.target.value === 'mg:') onBrowseMotion?.(); else if (e.target.value === 'hf:') onBrowseHyperframes?.(); else if (e.target.value === 'speech:') onOpenSpeech?.(); else if (e.target.value === 'generator:') onOpenGenerator?.(); else if (e.target.value === 'personalize:') onOpenPersonalization?.(); else if (e.target.value.startsWith('tpl:')) onAddTemplate?.(e.target.value.slice(4)); else onAdd(e.target.value as OverlayKind); }}
          style={{ flex: 1, minWidth: 0, background: 'transparent', color: 'inherit', border: '1px solid var(--border-medium, rgba(255,255,255,.18))', borderRadius: 6, fontSize: 11, padding: '3px 4px', cursor: 'pointer' }}>
          <option value="">+ Add overlay…</option>
          {onBrowseMotion && <option value="mg:">Motion graphics…</option>}
          {onBrowseHyperframes && <option value="hf:">Animations…</option>}
          {onOpenSpeech && <option value="speech:">Smart Speech…</option>}
          {onOpenGenerator && <option value="generator:">Template Generator…</option>}
          {onOpenPersonalization && <option value="personalize:">Personalization…</option>}
          {OVERLAY_KINDS.map((k) => <option key={k.kind} value={k.kind} title={k.blurb}>{k.label}</option>)}
          {onAddTemplate && <optgroup label="End screens and connect forms">{overlayTemplates().map((t) => <option key={t.id} value={`tpl:${t.id}`} title={t.description}>{t.name}</option>)}</optgroup>}
        </select>
      </div>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: Math.max(sequenceDuration, 1) * pxPerSecond, transform: `translateX(${-(scrollLeft)}px)` }}>
          {overlays.map((o) => {
            const on = selected === o.id;
            return (
              <div key={o.id} role="button" tabIndex={0} className={`overlay-lane__item${on ? ' overlay-lane__item--selected' : ''}`} title={isGateOverlay(o) ? `${o.name} · viewers fill this in before the video plays` : `${o.name} · ${o.start.toFixed(1)}s–${o.end.toFixed(1)}s`}
                onPointerDown={(e) => begin(e, o, 'move')}
                onKeyDown={(e) => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); onRemove(o.id); } }}
                style={{ position: 'absolute', top: 4, bottom: 4, left: o.start * pxPerSecond, width: Math.max(8, (o.end - o.start) * pxPerSecond), borderRadius: 6,
                  background: on ? 'rgba(235,80,84,.55)' : 'rgba(235,80,84,.32)', border: `1px solid ${on ? '#eb5054' : 'rgba(235,80,84,.6)'}`, color: '#fff', fontSize: 10, padding: '0 8px', display: 'flex', alignItems: 'center', cursor: 'grab', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {!isGateOverlay(o) && <span onPointerDown={(e) => begin(e, o, 'start')} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />}
                {isGateOverlay(o) ? `🔒 ${o.name}` : o.name}
                {!isGateOverlay(o) && (
                  <button type="button" className="overlay-lane__remove" title="Remove overlay" aria-label="Remove overlay"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onRemove(o.id); }}>&times;</button>
                )}
                {!isGateOverlay(o) && <span onPointerDown={(e) => begin(e, o, 'end')} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
