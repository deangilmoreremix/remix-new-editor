// [remix] The Overlays lane under the timeline ruler: one block per overlay (Lead Generator, List Builder, CTA). Drag a block to
// move it, drag its edges to trim, click to select (opens its settings), and add new ones at the playhead from the lane header.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OverlayClip, OverlayKind } from '@cinegen/types/workspace';
import { OVERLAY_KINDS, overlayTemplates, isGateOverlay } from '@cinegen/lib/overlays/overlays';
import { selectOverlay, useSelectedOverlay } from '@cinegen/lib/overlays/selection';
// @ts-expect-error plain JS add-on modules (the same Lottie builder the viewer uses)
import { buildLowerThirdLottie, LT_HOLD_FRAME } from '../../../lib/editor/addons/lowerThirds.js';
// @ts-expect-error plain JS add-on registry
import { addonOptions } from '../../../lib/editor/addons/registry.js';
// @ts-expect-error plain JS add-on renderer helpers
import { ensureFormFont } from '../../../lib/editor/addons/addonOverlay.js';
import { decodeLibraryDrag, freeOverlayRow, hasLibraryDrag, LIBRARY_DND, type LibraryDrag, type LibraryDropCtx } from '@cinegen/lib/occ/library-dnd';

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
  /** A Library card was dropped on this row area (time in seconds, row index). */
  onLibraryDrop?: (drag: LibraryDrag, ctx: LibraryDropCtx) => void;
}

const MIN = 0.5;

export function OverlayLane({ overlays, pxPerSecond, scrollLeft, labelWidth, sequenceDuration, onAdd, onAddTemplate, onBrowseMotion, onBrowseHyperframes, onOpenSpeech, onOpenGenerator, onOpenPersonalization, onUpdate, onRemove, onLibraryDrop }: Props) {
  const selected = useSelectedOverlay();
  const overlaysRef = useRef(overlays); overlaysRef.current = overlays;
  const rowsRef = useRef<Map<string, number>>(new Map());
  const countRef = useRef(1);
  const rowHRef = useRef(46);
  const drag = useRef<{ id: string; mode: 'move' | 'start' | 'end'; x: number; y: number; start: number; end: number; row: number } | null>(null);

  const begin = (e: React.PointerEvent, o: OverlayClip, mode: 'move' | 'start' | 'end') => {
    e.stopPropagation();
    selectOverlay(o.id);
    (e.currentTarget as HTMLElement).focus?.(); // so Delete / Backspace act on this block
    if (isGateOverlay(o)) return; // the List Builder is a gate locked at 0s
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: o.id, mode, x: e.clientX, y: e.clientY, start: o.start, end: o.end, row: rowsRef.current.get(o.id) ?? 0 };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dt = (e.clientX - d.x) / pxPerSecond;
    if (d.mode === 'move') {
      const len = d.end - d.start;
      const start = Math.max(0, d.start + dt);
      // Dragging up / down moves the block to another row (a free row; one new row below the last is allowed).
      const wanted = Math.max(0, Math.min(rowsRef.current.size ? countRef.current : 0, d.row + Math.round((e.clientY - d.y) / rowHRef.current)));
      const row = freeOverlayRow(overlaysRef.current, { id: d.id, start, end: start + len }, wanted, rowsRef.current);
      onUpdate(d.id, { start, end: start + len, ...(row !== d.row || typeof overlaysRef.current.find((x) => x.id === d.id)?.row === 'number' ? { row } : {}) });
    } else if (d.mode === 'start') onUpdate(d.id, { start: Math.max(0, Math.min(d.start + dt, d.end - MIN)) });
    else onUpdate(d.id, { end: Math.max(d.start + MIN, d.end + dt) });
  };
  const end = () => { drag.current = null; };

  const [open, setOpen] = useState(true);
  // Overlays that overlap in time go on their own row (like stacked tracks), so every block stays readable.
  const { rows, count } = useMemo(() => {
    const rowOf = new Map<string, number>();
    const placed: Array<{ start: number; end: number; row: number }> = [];
    for (const o of overlays) if (typeof o.row === 'number') { rowOf.set(o.id, Math.max(0, Math.floor(o.row))); placed.push({ start: o.start, end: o.end, row: rowOf.get(o.id)! }); }
    for (const o of [...overlays].filter((x) => typeof x.row !== 'number').sort((a, b) => a.start - b.start)) {
      let r = 0;
      while (placed.some((p) => p.row === r && p.start < o.end - 1e-6 && p.end > o.start + 1e-6)) r++;
      rowOf.set(o.id, r); placed.push({ start: o.start, end: o.end, row: r });
    }
    return { rows: rowOf, count: Math.max(1, ...[...rowOf.values()].map((r) => r + 1)) };
  }, [overlays]);
  rowsRef.current = rows; countRef.current = count;
  const ROW = 46;
  const rowH = open ? ROW : 26;
  rowHRef.current = rowH;
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
      <div className="overlay-track__clips" style={{ overflowX: 'hidden', overflowY: contentH > height ? 'auto' : 'hidden' }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
        onDragOver={(e) => { if (hasLibraryDrag(e.dataTransfer.types)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
        onDrop={(e) => {
          const drag = decodeLibraryDrag(e.dataTransfer.getData(LIBRARY_DND));
          if (!drag || !onLibraryDrop) return;
          e.preventDefault(); e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const time = Math.max(0, (e.clientX - rect.left + scrollLeft) / pxPerSecond);
          const want = open ? Math.max(0, Math.min(count, Math.floor((e.clientY - rect.top + e.currentTarget.scrollTop) / rowH))) : 0;
          const taken = overlays.some((o) => (rows.get(o.id) ?? 0) === want && o.start < time + 1 && o.end > time);
          onLibraryDrop(drag, { time, ...(taken ? {} : { row: want }) });
        }}>
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
                className={`overlay-lane__item overlay-card${on ? ' overlay-lane__item--selected overlay-card--selected' : ''}${open ? '' : ' overlay-card--compact'}`}
                title={gate ? `${o.name} · viewers fill this in before the video plays` : `${o.name} · ${o.start.toFixed(1)}s–${o.end.toFixed(1)}s`}
                onPointerDown={(e) => begin(e, o, 'move')}
                onKeyDown={(e) => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); onRemove(o.id); } }}
                style={{ left: o.start * pxPerSecond, width: w, top: 4 + row * rowH, height: rowH - 6, bottom: 'auto' }}>
                {!gate && <span className="overlay-card__handle overlay-card__handle--start" onPointerDown={(e) => begin(e, o, 'start')} />}
                {open && o.type === ('overlay-lower-third' as OverlayKind) && <LowerThirdThumb clip={o} />}
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

/** A small picture of the lower third (its template, text and colours) at its fully-in frame, so the block shows the animation itself. */
function LowerThirdThumb({ clip }: { clip: OverlayClip }) {
  const host = useRef<HTMLDivElement>(null);
  const key = JSON.stringify((clip as unknown as { addon?: unknown }).addon ?? null);
  useEffect(() => {
    const el = host.current;
    if (!el) return undefined;
    let anim: { destroy: () => void; goToAndStop: (f: number, isFrame: boolean) => void } | null = null;
    let live = true;
    try {
      const opts = addonOptions(clip) as Record<string, unknown>;
      ensureFormFont(opts.fontFamily);
      const data = buildLowerThirdLottie(opts);
      void import('lottie-web').then(({ default: lottie }) => {
        if (!live || !el.isConnected) return;
        anim = lottie.loadAnimation({ container: el, renderer: 'svg', loop: false, autoplay: false, animationData: data });
        anim.goToAndStop(LT_HOLD_FRAME, true);
      }).catch(() => { /* no picture: the block keeps its name and time */ });
    } catch { /* unreadable options: no picture */ }
    return () => { live = false; try { anim?.destroy(); } catch { /* already gone */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <div ref={host} className="overlay-card__thumb overlay-card__thumb--lt" aria-hidden="true" />;
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
