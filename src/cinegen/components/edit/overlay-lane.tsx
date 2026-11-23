// [remix] The Overlays lane under the timeline ruler: one block per overlay (Lead Generator, List Builder, CTA). Drag a block to
// move it, drag its edges to trim, click to select (opens its settings), and add new ones at the playhead from the lane header.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OverlayClip, OverlayKind } from '@cinegen/types/workspace';
import { LiveStage, STAGE_BG, useInView, useLiveSlot } from './preview-card';
import type { CardPreview } from './preview-types';
import { isGateOverlay } from '@cinegen/lib/overlays/overlays';
import { selectOverlay, useSelectedOverlay } from '@cinegen/lib/overlays/selection';
import { usePreviewContact, type ContactProfile } from '@cinegen/lib/personalize/preview-contact';
// @ts-expect-error plain JS: fills {{tokens}} with a contact's details (the same call the viewer makes)
import { resolveOverlayText } from '../../../lib/editor/addons/overlayRender.js';
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
  /** Opens the "Add to timeline" modal (animations, speech, overlays, forms, end screens) */
  onOpenAdd: () => void;
  /** Smart Speech has its own modal (personalized speech), so it is not part of the Add modal */
  onOpenSpeech?: () => void;
  /** Template Generator and Personalization also have their own modals */
  onOpenGenerator?: () => void;
  onOpenPersonalization?: () => void;
  onUpdate: (id: string, updates: Partial<OverlayClip>) => void;
  /** Remove an overlay from the timeline (the × on its block, or Delete / Backspace while it is selected). */
  onRemove: (id: string) => void;
  /** A Library card was dropped on this row area (time in seconds, row index). */
  onLibraryDrop?: (drag: LibraryDrag, ctx: LibraryDropCtx) => void;
  /** A picture from the Media pool was dropped on this row area (time in seconds, row index): it becomes an Image overlay. */
  onAssetDrop?: (assetId: string, ctx: { time: number; row?: number }) => void;
}

const ASSET_DND = 'application/x-asset-id';

const MIN = 0.5;

/** The small icon buttons next to + Add: each opens its own modal (they are not part of the Add modal). */
const ICON_BTN = { flex: '0 0 auto', background: 'transparent', color: 'inherit', border: '1px solid var(--border-medium, rgba(255,255,255,.18))', borderRadius: 6, fontSize: 12, padding: '2px 4px', cursor: 'pointer' } as const;

export function OverlayLane({ overlays, pxPerSecond, scrollLeft, labelWidth, sequenceDuration, onOpenAdd, onOpenSpeech, onOpenGenerator, onOpenPersonalization, onUpdate, onRemove, onLibraryDrop, onAssetDrop }: Props) {
  const selected = useSelectedOverlay();
  const contact = usePreviewContact(); // the contact the preview shows: the lane's pictures and text use them too
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
  const ROW = 60; // tall enough for a readable picture of what the overlay shows
  const rowH = open ? ROW : 26;
  rowHRef.current = rowH;
  const contentH = (open ? count : 1) * rowH + 8;
  const empty = overlays.length === 0;
  const height = empty ? 30 : Math.min(contentH, 2 * ROW + 8); // empty: one slim row (just the add menu); otherwise at most 2 rows tall, more scroll inside the track

  return (
    <div className="overlay-track" data-testid="overlay-lane" style={{ height, background: 'var(--bg-surface, #0b0e14)' }}>
      <div className="overlay-track__label" title="Overlays: forms and buttons drawn over the video" style={{ width: labelWidth }}>
        {!empty && <div className="overlay-track__label-top">
          <button type="button" className="overlay-lane__toggle" aria-expanded={open} aria-label={open ? 'Collapse overlays' : 'Expand overlays'} title={open ? 'Collapse overlays' : 'Expand overlays'} onClick={() => setOpen((v) => !v)}>{open ? '▾' : '▸'}</button>
          <span className="overlay-track__label-text">Overlays{overlays.length ? ` · ${overlays.length}` : ''}</span>
        </div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <button type="button" aria-label="Add to timeline" title="Add to timeline: animations, motion graphics, overlays, forms and end screens" onClick={onOpenAdd}
            style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'var(--bg-input, transparent)', color: 'inherit', border: '1px solid var(--border-medium, rgba(255,255,255,.18))', borderRadius: 6, fontSize: 11, padding: '3px 5px', cursor: 'pointer', textAlign: 'left' }}>
            + Add
          </button>
          {onOpenSpeech && <button type="button" aria-label="Smart Speech" title="Smart Speech: personalized speech" onClick={onOpenSpeech} style={ICON_BTN}>🎙</button>}
          {onOpenGenerator && <button type="button" aria-label="Template Generator" title="Template Generator: generate a templated video from a prompt" onClick={onOpenGenerator} style={ICON_BTN}>✨</button>}
          {onOpenPersonalization && <button type="button" aria-label="Personalization" title="Personalization: personalize the video for each contact" onClick={onOpenPersonalization} style={ICON_BTN}>👤</button>}
        </div>
      </div>
      <div className="overlay-track__clips" style={{ overflowX: 'hidden', overflowY: contentH > height ? 'auto' : 'hidden' }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
        onDragOver={(e) => {
          const types = Array.from(e.dataTransfer.types ?? []);
          if (hasLibraryDrag(e.dataTransfer.types) || (onAssetDrop && types.includes(ASSET_DND))) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
        }}
        onDrop={(e) => {
          const drag = decodeLibraryDrag(e.dataTransfer.getData(LIBRARY_DND));
          const assetId = e.dataTransfer.getData(ASSET_DND);
          if ((!drag || !onLibraryDrop) && !(assetId && onAssetDrop)) return;
          e.preventDefault(); e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const time = Math.max(0, (e.clientX - rect.left + scrollLeft) / pxPerSecond);
          const want = open ? Math.max(0, Math.min(count, Math.floor((e.clientY - rect.top + e.currentTarget.scrollTop) / rowH))) : 0;
          const taken = overlays.some((o) => (rows.get(o.id) ?? 0) === want && o.start < time + 1 && o.end > time);
          const ctx = { time, ...(taken ? {} : { row: want }) };
          if (drag && onLibraryDrop) onLibraryDrop(drag, ctx);
          else if (assetId && onAssetDrop) onAssetDrop(assetId, ctx);
        }}>
        <div style={{ position: 'relative', height: contentH, width: Math.max(sequenceDuration, 1) * pxPerSecond, transform: `translateX(${-(scrollLeft)}px)` }}>
          {overlays.map((o) => {
            const on = selected === o.id;
            const gate = isGateOverlay(o);
            const row = open ? (rows.get(o.id) ?? 0) : 0;
            const w = Math.max(24, (o.end - o.start) * pxPerSecond);
            const thumb = overlayThumb(o);
            const text = overlayText(o, contact.profile);
            // what fits in the block: a picture + text when wide, text alone when medium, just an icon when narrow (the title still says everything)
            const glyph = GLYPHS[o.type as string];
            const roomy = w >= 190;
            const showText = w >= 90;
            return (
              <div key={o.id} role="button" tabIndex={0} data-testid={`overlay-card-${o.id}`}
                className={`overlay-lane__item overlay-card${on ? ' overlay-lane__item--selected overlay-card--selected' : ''}${open ? '' : ' overlay-card--compact'}`}
                title={gate ? `${o.name} · viewers fill this in before the video plays` : `${o.name} · ${o.start.toFixed(1)}s–${o.end.toFixed(1)}s`}
                onPointerDown={(e) => begin(e, o, 'move')}
                onKeyDown={(e) => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); onRemove(o.id); } }}
                style={{ left: o.start * pxPerSecond, width: w, top: 4 + row * rowH, height: rowH - 6, bottom: 'auto' }}>
                {!gate && <span className="overlay-card__handle overlay-card__handle--start" onPointerDown={(e) => begin(e, o, 'start')} />}
                {open && roomy && o.type === ('overlay-lower-third' as OverlayKind) && <LowerThirdThumb clip={o} profile={contact.profile} version={contact.version} />}
                {open && roomy && glyph && <span className="overlay-card__thumb" aria-hidden="true" style={GLYPH_BOX}>{glyph}</span>}
                {open && roomy && !glyph && !thumb && o.type !== ('overlay-lower-third' as OverlayKind) && <OverlayStill clip={o} profile={contact.profile} version={contact.version} />}
                {open && roomy && !glyph && thumb && <img className="overlay-card__thumb" src={thumb} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
                {open && !roomy && !showText && <span className="overlay-card__thumb" aria-hidden="true" style={{ ...GLYPH_BOX, aspectRatio: '1 / 1' }}>{glyph ?? '▭'}</span>}
                {showText && (
                  <span className="overlay-card__body">
                    <span className="overlay-card__name">{gate ? `🔒 ${o.name}` : o.name}</span>
                    {open && <span className="overlay-card__meta">{text || `${o.start.toFixed(1)}s – ${o.end.toFixed(1)}s`}</span>}
                  </span>
                )}
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

/** Overlays that draw nothing of their own (they control playback) get an icon instead of a blank picture. */
const GLYPHS: Record<string, string> = { 'addon-pause': '⏸', 'addon-skip': '⏭', 'addon-loop': '🔁' };
const GLYPH_BOX = { display: 'grid', placeItems: 'center', fontSize: 20, lineHeight: 1, background: STAGE_BG } as const;

/** The live stage is drawn at a normal card size and scaled down to fit the block: drawn directly into the small box it was cropped to a corner of the form. */
const STILL_W = 480;
const STILL_H = 270;
/** A small still of an overlay that ships no thumbnail (lead form, list builder, call-to-action, text, stickers, end screens...), drawn
 *  with the same live renderer as the Add window's cards. Only drawn while on screen, and from a shared pool, so a long lane stays cheap. */
function OverlayStill({ clip, profile = null, version = 0 }: { clip: OverlayClip; profile?: ContactProfile | null; version?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  const slot = useLiveSlot(visible);
  const [scale, setScale] = useState(0.2);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => { if (el.clientWidth > 0) setScale(el.clientWidth / STILL_W); };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const span = Math.max(1, clip.end - clip.start);
  const form = clip.type === ('lead-form' as OverlayKind) || clip.type === ('list-builder' as OverlayKind);
  const preview = useMemo<CardPreview>(() => ({ kind: 'overlay', build: () => [{ ...clip, start: 0, end: span }], duration: span, still: form ? 0.2 : Math.min(span * 0.5, 2.5) }), [clip, span, form]);
  return (
    <div ref={ref} className="overlay-card__thumb" aria-hidden="true" style={{ position: 'relative', background: STAGE_BG, overflow: 'hidden' }}>
      {visible && slot && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: STILL_W, height: STILL_H, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
          <LiveStage preview={preview} playing={false} profile={profile} profileVersion={version} />
        </div>
      )}
    </div>
  );
}

/** A small picture of the lower third (its template, text and colours) at its fully-in frame, so the block shows the animation itself. */
function LowerThirdThumb({ clip, profile = null, version = 0 }: { clip: OverlayClip; profile?: ContactProfile | null; version?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const key = `${String(profile?.id ?? '')}#${version}|${JSON.stringify((clip as unknown as { addon?: unknown }).addon ?? null)}`;
  useEffect(() => {
    const el = host.current;
    if (!el) return undefined;
    let anim: { destroy: () => void; goToAndStop: (f: number, isFrame: boolean) => void } | null = null;
    let live = true;
    try {
      const opts = addonOptions(clip) as Record<string, unknown>;
      ensureFormFont(opts.fontFamily);
      // name and title are filled in for the previewed contact, like the video does
      const data = buildLowerThirdLottie({ ...opts, name: resolveOverlayText(opts.name, profile), title: resolveOverlayText(opts.title, profile) });
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
  // an Image overlay shows the picture that was picked for it
  if (o.type === ('overlay-image' as OverlayKind)) {
    const src = (addonOptions(o) as { src?: unknown }).src;
    if (typeof src === 'string' && src.trim()) return src;
  }
  if (o.type === ('hyperframes' as OverlayKind) && id) return `/hyperframes/thumbs/${id.replace(':', '-')}.jpg`;
  // motion-graphics templates (e.g. "Portrait · keyword pop-up"): one rendered frame per template, shipped in public/occ-templates/thumbs
  const tpl = typeof (o as unknown as { templateId?: unknown }).templateId === 'string' ? (o as unknown as { templateId: string }).templateId : '';
  return o.type === ('mg-template' as OverlayKind) && /^[a-zA-Z0-9_-]{1,80}$/.test(tpl) ? `/occ-templates/thumbs/${tpl}.jpg` : null;
}

/** The overlay's own text, so the block shows what it says and not just its name. */
function overlayText(o: OverlayClip, profile: ContactProfile | null = null): string {
  const props = (o.props && typeof o.props === 'object' ? (o.props as Record<string, unknown>) : {});
  const addon = (o.addon && typeof o.addon === 'object' ? (o.addon as Record<string, unknown>) : {}); // Smart Text and the other add-ons keep their options here
  const config = (o.config && typeof o.config === 'object' ? (o.config as Record<string, unknown>) : {}); // the List Builder keeps its options here
  for (const src of [o, props, addon, config]) {
    for (const k of ['text', 'title', 'headline', 'heading', 'caption', 'label', 'buttonText', 'name1', 'line1']) {
      const v = (src as Record<string, unknown>)[k];
      if (typeof v === 'string' && v.trim() && v !== o.name) return String(resolveOverlayText(v.trim(), profile)).slice(0, 80);
    }
  }
  return '';
}
