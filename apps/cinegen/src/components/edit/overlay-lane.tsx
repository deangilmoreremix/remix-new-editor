import { useCallback, useRef } from 'react';
import type { OverlayClip, OverlayKind } from '@/types/timeline';
import { OVERLAY_KIND_LABELS, isGateKind } from '@/lib/optin/overlay-kinds';

/** Same width as the track header column, so the lane lines up with the tracks. */
const LABEL_WIDTH = 150;
const MIN_LENGTH = 0.5;

interface OverlayLaneProps {
  overlays: OverlayClip[];
  pxPerSecond: number;
  scrollLeft: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (kind: OverlayKind) => void;
  onChangeTimes: (id: string, start: number, end: number) => void;
}

/** "+ Add overlay…" dropdown and the lane of overlay bars above the tracks. */
export function OverlayLane({ overlays, pxPerSecond, scrollLeft, selectedId, onSelect, onAdd, onChangeTimes }: OverlayLaneProps) {
  const drag = useRef<{ id: string; mode: 'move' | 'start' | 'end'; x: number; start: number; end: number } | null>(null);
  const hasGate = overlays.some((o) => isGateKind(o.kind));

  const beginDrag = useCallback((e: React.PointerEvent, o: OverlayClip, mode: 'move' | 'start' | 'end') => {
    e.stopPropagation();
    onSelect(o.id);
    if (isGateKind(o.kind)) return; // a gate is locked at 0s
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: o.id, mode, x: e.clientX, start: o.start, end: o.end };
  }, [onSelect]);

  const moveDrag = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dt = (e.clientX - d.x) / Math.max(1, pxPerSecond);
    let start = d.start;
    let end = d.end;
    if (d.mode === 'move') {
      start = Math.max(0, d.start + dt);
      end = start + (d.end - d.start);
    } else if (d.mode === 'start') {
      start = Math.min(d.end - MIN_LENGTH, Math.max(0, d.start + dt));
    } else {
      end = Math.max(d.start + MIN_LENGTH, d.end + dt);
    }
    onChangeTimes(d.id, Math.round(start * 100) / 100, Math.round(end * 100) / 100);
  }, [pxPerSecond, onChangeTimes]);

  const endDrag = useCallback(() => { drag.current = null; }, []);

  return (
    <div className="overlay-lane" data-testid="overlay-lane" onClick={() => onSelect(null)}>
      <div className="overlay-lane__gutter" style={{ width: LABEL_WIDTH }}>
        <select
          className="overlay-lane__add"
          aria-label="Add overlay"
          value=""
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const kind = e.target.value as OverlayKind;
            if (kind) onAdd(kind);
          }}
        >
          <option value="">+ Add overlay…</option>
          <option value="list-builder" disabled={hasGate}>List Builder{hasGate ? ' (already added)' : ''}</option>
          <option value="personalizer" disabled={hasGate}>Personalizer{hasGate ? ' (already added)' : ''}</option>
          <option value="lead-generator">Lead Generator</option>
        </select>
      </div>
      <div className="overlay-lane__track">
        <div className="overlay-lane__inner" style={{ transform: `translateX(${-scrollLeft}px)` }}>
          {overlays.map((o) => {
            const gate = isGateKind(o.kind);
            return (
              <div
                key={o.id}
                className={`overlay-lane__bar overlay-lane__bar--${gate ? 'gate' : 'lead'}${o.id === selectedId ? ' is-selected' : ''}`}
                style={{ left: o.start * pxPerSecond, width: Math.max(24, (o.end - o.start) * pxPerSecond) }}
                title={gate ? `${OVERLAY_KIND_LABELS[o.kind]} — viewers fill this out before the video plays` : OVERLAY_KIND_LABELS[o.kind]}
                onClick={(e) => { e.stopPropagation(); onSelect(o.id); }}
                onPointerDown={(e) => beginDrag(e, o, 'move')}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
              >
                {!gate && <span className="overlay-lane__handle overlay-lane__handle--start" onPointerDown={(e) => beginDrag(e, o, 'start')} onPointerMove={moveDrag} onPointerUp={endDrag} />}
                <span className="overlay-lane__label">{gate ? '🔒 ' : ''}{o.name}</span>
                {!gate && <span className="overlay-lane__handle overlay-lane__handle--end" onPointerDown={(e) => beginDrag(e, o, 'end')} onPointerMove={moveDrag} onPointerUp={endDrag} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
