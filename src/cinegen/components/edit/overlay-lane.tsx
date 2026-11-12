// [remix] The Overlays lane under the timeline ruler: one block per overlay (Lead Generator, List Builder, CTA). Drag a block to
// move it, drag its edges to trim, click to select (opens its settings), and add new ones at the playhead from the lane header.
import { useRef } from 'react';
import type { OverlayClip } from '@cinegen/types/workspace';
import { isGateOverlay } from '@cinegen/lib/overlays/overlays';
import { selectOverlay, useSelectedOverlay } from '@cinegen/lib/overlays/selection';

interface Props {
  overlays: OverlayClip[];
  pxPerSecond: number;
  scrollLeft: number;
  labelWidth: number;
  sequenceDuration: number;
  /** Opens the "Add to timeline" modal (animations, speech, overlays, forms, end screens) */
  onOpenAdd: () => void;
  /** Smart Speech has its own modal (personalized speech), so it is not part of the Add modal */
  onOpenSpeech?: () => void;
  /** Template Generator and Personalization also have their own modals */
  onOpenGenerator?: () => void;
  onOpenPersonalization?: () => void;
  onUpdate: (id: string, updates: Partial<OverlayClip>) => void;
}

const MIN = 0.5;

export function OverlayLane({ overlays, pxPerSecond, scrollLeft, labelWidth, sequenceDuration, onOpenAdd, onOpenSpeech, onOpenGenerator, onOpenPersonalization, onUpdate }: Props) {
  const selected = useSelectedOverlay();
  const drag = useRef<{ id: string; mode: 'move' | 'start' | 'end'; x: number; start: number; end: number } | null>(null);

  const begin = (e: React.PointerEvent, o: OverlayClip, mode: 'move' | 'start' | 'end') => {
    e.stopPropagation();
    selectOverlay(o.id);
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
        <button type="button" aria-label="Add to timeline" title="Add an animation, speech, overlay, form or end screen at the playhead" onClick={onOpenAdd}
          style={{ flex: 1, minWidth: 0, background: 'transparent', color: 'inherit', border: '1px solid var(--border-medium, rgba(255,255,255,.18))', borderRadius: 6, fontSize: 11, padding: '3px 4px', cursor: 'pointer', textAlign: 'left' }}>
          + Add to timeline…
        </button>
        {onOpenSpeech && <button type="button" aria-label="Smart Speech" title="Smart Speech: personalized speech" onClick={onOpenSpeech} style={{ flex: '0 0 auto', background: 'transparent', color: 'inherit', border: '1px solid var(--border-medium, rgba(255,255,255,.18))', borderRadius: 6, fontSize: 12, padding: '2px 6px', cursor: 'pointer' }}>🎙</button>}
        {onOpenGenerator && <button type="button" aria-label="Template Generator" title="Template Generator: generate a templated video from a prompt" onClick={onOpenGenerator} style={{ flex: '0 0 auto', background: 'transparent', color: 'inherit', border: '1px solid var(--border-medium, rgba(255,255,255,.18))', borderRadius: 6, fontSize: 12, padding: '2px 6px', cursor: 'pointer' }}>✨</button>}
        {onOpenPersonalization && <button type="button" aria-label="Personalization" title="Personalization: personalize the video for each contact" onClick={onOpenPersonalization} style={{ flex: '0 0 auto', background: 'transparent', color: 'inherit', border: '1px solid var(--border-medium, rgba(255,255,255,.18))', borderRadius: 6, fontSize: 12, padding: '2px 6px', cursor: 'pointer' }}>👤</button>}
      </div>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: Math.max(sequenceDuration, 1) * pxPerSecond, transform: `translateX(${-(scrollLeft)}px)` }}>
          {overlays.map((o) => {
            const on = selected === o.id;
            return (
              <div key={o.id} role="button" tabIndex={0} title={isGateOverlay(o) ? `${o.name} · viewers fill this in before the video plays` : `${o.name} · ${o.start.toFixed(1)}s–${o.end.toFixed(1)}s`}
                onPointerDown={(e) => begin(e, o, 'move')}
                style={{ position: 'absolute', top: 4, bottom: 4, left: o.start * pxPerSecond, width: Math.max(8, (o.end - o.start) * pxPerSecond), borderRadius: 6,
                  background: on ? 'rgba(235,80,84,.55)' : 'rgba(235,80,84,.32)', border: `1px solid ${on ? '#eb5054' : 'rgba(235,80,84,.6)'}`, color: '#fff', fontSize: 10, padding: '0 8px', display: 'flex', alignItems: 'center', cursor: isGateOverlay(o) ? 'default' : 'grab', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {!isGateOverlay(o) && <span onPointerDown={(e) => begin(e, o, 'start')} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />}
                {isGateOverlay(o) ? `🔒 ${o.name}` : o.name}
                {!isGateOverlay(o) && <span onPointerDown={(e) => begin(e, o, 'end')} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
