// [remix] The Overlays lane under the timeline ruler: one block per overlay (Lead Generator, List Builder, CTA). Drag a block to
// move it, drag its edges to trim, click to select (opens its settings), and add new ones at the playhead from the lane header.
import { useMemo, useRef, useState } from 'react';
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

  const [open, setOpen] = useState(true);
  // Overlays that overlap in time go on their own row (like stacked tracks), so every block stays readable.
  const { rows, count } = useMemo(() => {
    const sorted = [...overlays].sort((a, b) => a.start - b.start);
    const ends: number[] = [];
    const rowOf = new Map<string, number>();
    for (const o of sorted) {
      let r = ends.findIndex((e) => e <= o.start + 1e-6);
      if (r < 0) { r = ends.length; ends.push(0); }
      ends[r] = o.end; rowOf.set(o.id, r);
    }
    return { rows: rowOf, count: Math.max(1, ends.length) };
  }, [overlays]);
  const ROW = 46;
  const rowH = open ? ROW : 26;
  const contentH = (open ? count : 1) * rowH + 8;
  const empty = overlays.length === 0;
  const height = empty ? 30 : Math.min(contentH, 3 * ROW + 8); // empty: one slim row (just the add menu); otherwise at most 3 rows tall, more scroll inside the track

  return (
    <div className="overlay-track" data-testid="overlay-lane" style={{ height, background: 'var(--bg-surface, #0b0e14)' }}>
      <div className="overlay-track__label" title="Overlays: forms and buttons drawn over the video" style={{ width: labelWidth }}>
        {!empty && <div className="overlay-track__label-top">
          <button type="button" className="overlay-lane__toggle" aria-expanded={open} aria-label={open ? 'Collapse overlays' : 'Expand overlays'} title={open ? 'Collapse overlays' : 'Expand overlays'} onClick={() => setOpen((v) => !v)}>{open ? '▾' : '▸'}</button>
          <span className="overlay-track__label-text">Overlays{overlays.length ? ` · ${overlays.length}` : ''}</span>
        </div>}
        <select aria-label="Add overlay" title="Add an overlay at the playhead" value="" onChange={(e) => { if (!e.target.value) return; if (e.target.value === 'mg:') onBrowseMotion?.(); else if (e.target.value === 'hf:') onBrowseHyperframes?.(); else if (e.target.value === 'speech:') onOpenSpeech?.(); else if (e.target.value === 'generator:') onOpenGenerator?.(); else if (e.target.value === 'personalize:') onOpenPersonalization?.(); else if (e.target.value.startsWith('tpl:')) onAddTemplate?.(e.target.value.slice(4)); else onAdd(e.target.value as OverlayKind); }}
          className="overlay-lane__add">
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
      <div className="overlay-track__clips" style={{ overflowX: 'hidden', overflowY: contentH > height ? 'auto' : 'hidden' }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <div style={{ position: 'relative', height: contentH, width: Math.max(sequenceDuration, 1) * pxPerSecond, transform: `translateX(${-(scrollLeft)}px)` }}>
          {overlays.map((o) => {
            const on = selected === o.id;
            const gate = isGateOverlay(o);
            const row = open ? (rows.get(o.id) ?? 0) : 0;
            const w = Math.max(24, (o.end - o.start) * pxPerSecond);
            const thumb = overlayThumb(o);
            const text = overlayText(o);
            return (
              <div key={o.id} role="button" tabIndex={0} data-testid={`overlay-card-${o.id}`}
                className={`overlay-lane__item clip-card overlay-card${on ? ' overlay-lane__item--selected overlay-card--selected' : ''}${open ? '' : ' overlay-card--compact'}`}
                title={gate ? `${o.name} · viewers fill this in before the video plays` : `${o.name} · ${o.start.toFixed(1)}s–${o.end.toFixed(1)}s`}
                onPointerDown={(e) => begin(e, o, 'move')}
                onKeyDown={(e) => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); onRemove(o.id); } }}
                style={{ left: o.start * pxPerSecond, width: w, top: 4 + row * rowH, height: rowH - 6, bottom: 'auto' }}>
                {!gate && <span className="overlay-card__handle overlay-card__handle--start" onPointerDown={(e) => begin(e, o, 'start')} />}
                {open && thumb && <img className="overlay-card__thumb" src={thumb} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
                <span className="overlay-card__body">
                  <span className="overlay-card__name">{gate ? `🔒 ${o.name}` : o.name}</span>
                  {open && <span className="overlay-card__meta">{text || `${o.start.toFixed(1)}s – ${o.end.toFixed(1)}s`}</span>}
                </span>
                {!gate && (
                  <button type="button" className="overlay-lane__remove" title="Remove overlay" aria-label="Remove overlay"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onRemove(o.id); }}>&times;</button>
                )}
                {!gate && <span className="overlay-card__handle overlay-card__handle--end" onPointerDown={(e) => begin(e, o, 'end')} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** A small picture for the block, when the overlay has one (library animations ship a thumbnail). */
function overlayThumb(o: OverlayClip): string | null {
  const id = typeof o.blockId === 'string' ? o.blockId : '';
  return o.type === ('hyperframes' as OverlayKind) && id ? `/hyperframes/thumbs/${id.replace(':', '-')}.jpg` : null;
}

/** The overlay's own text, so the block shows what it says and not just its name. */
function overlayText(o: OverlayClip): string {
  const props = (o.props && typeof o.props === 'object' ? (o.props as Record<string, unknown>) : {});
  for (const src of [o, props]) {
    for (const k of ['text', 'title', 'headline', 'heading', 'label', 'buttonText', 'name1', 'line1']) {
      const v = (src as Record<string, unknown>)[k];
      if (typeof v === 'string' && v.trim() && v !== o.name) return v.trim().slice(0, 80);
    }
  }
  return '';
}
