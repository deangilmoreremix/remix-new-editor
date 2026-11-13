// [remix] Draws the overlays (Lead Generator, List Builder, CTA) over the video at the playhead. The forms are the old editor's own
// renderers (publish/viewerOverlays.js `showLeadForm`, addons/addonOverlay.js `showListBuilderOverlay`), so they keep the old look
// (red button, rounded black card). A form that gates playback pauses the video until it is submitted or skipped.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS renderers from the main app
import { showLeadForm } from '../../../lib/editor/publish/viewerOverlays.js';
// @ts-expect-error plain JS renderers from the main app
import { showListBuilderOverlay } from '../../../lib/editor/addons/addonOverlay.js';
// @ts-expect-error plain JS lead helpers
import { postWebhooksDirect, webhookUrlsFor } from '../../../lib/editor/addons/leadClient.js';
// @ts-expect-error plain JS opt-in form config helpers
import { normalizeListBuilder, listBuilderWebhookConfig } from '../../../lib/editor/addons/listBuilder.js';
// @ts-expect-error plain JS add-on renderers (Smart Text, Text Mask, Image, Personalized Image, Stickers, Wrapper, Lower Thirds)
import { buildOverlayElement, finishOverlayElement, destroyOverlayElement, syncOverlayTime, setOverlayPlaying } from '../../../lib/editor/addons/overlayRender.js';
// @ts-expect-error plain JS drag / resize handles
import { attachDragResize } from '../../../lib/editor/addons/dragResize.js';
// @ts-expect-error plain JS: the same CTA box helper the export uses
import { ctaBox } from '../../../lib/editor/addons/ctaLottie.js';
import { mgOverlayLayer } from '@cinegen/lib/occ/mg-templates';
import { overlaysAt, isRegistryOverlay } from '@cinegen/lib/overlays/overlays';
import { hyperframesOverlayLayer, hyperframesItem, defaultFit } from '@cinegen/lib/hyperframes/overlay';
// @ts-expect-error plain JS placement helpers (same math the renderer and the export use)
import { hfPlacement, isReactItem } from '../../../lib/hyperframes/placement.js';
import { useSelectedOverlay, selectOverlay } from '@cinegen/lib/overlays/selection';
import '../../../../styles/timeline-addons.css';
import '../../../../styles/watch.css';

interface Props { overlays: OverlayClip[]; currentTime: number; isPlaying: boolean; /** play animated add-ons (stickers, lottie, media) without making forms interactive: used by thumbnails */ previewPlaying?: boolean; onPause: () => void; /** play again once the form that held the video is submitted or skipped */ onResume?: () => void; /** click-to-edit text on the form while stopped: the option key and its new text */ onEditText?: (id: string, key: string, value: string) => void; onGeometry?: (id: string, geometry: Record<string, number>) => void; frame?: { width: number; height: number } }

const GATES = new Set(['lead-form', 'list-builder']);

async function sendLead(o: OverlayClip, data: Record<string, unknown>) {
  try {
    const key = `remix.cinegen.leads.${o.id}`;
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...prev, { ...data, submittedAt: new Date().toISOString() }]));
  } catch { /* storage unavailable */ }
  const cfg = (o.type === 'list-builder' ? o.config : o) as Record<string, unknown>;
  const urls = webhookUrlsFor(o.type === 'list-builder' ? listBuilderWebhookConfig(cfg) : cfg) as string[];
  if (urls?.length) await postWebhooksDirect(urls, data);
  return { ok: true };
}

/** Move / resize handles for the selected animation. The outline is the animation's own canvas placed in the frame; edits are committed on release. */
function HfHandle({ overlay, frame, onGeometry }: { overlay: OverlayClip; frame: { width: number; height: number }; onGeometry?: (id: string, g: Record<string, number>) => void }) {
  const item = hyperframesItem(String(overlay.blockId ?? ''));
  const isRui = isReactItem(String(overlay.blockId ?? ''));
  const bw = isRui || !item ? frame.width : item.dimensions.width; const bh = isRui || !item ? frame.height : item.dimensions.height;
  const [draft, setDraft] = useState<{ x?: number; y?: number; scale?: number } | null>(null);
  const geom = { ...((overlay.geom as Record<string, unknown>) ?? {}), ...(draft ?? {}) };
  const p = hfPlacement(frame.width, frame.height, bw, bh, geom, item && !isRui ? defaultFit(item) : 'contain');
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  const start = (mode: 'move' | 'scale') => (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault(); e.stopPropagation();
    const host = (e.currentTarget.closest('[data-hf-handle-root]') as HTMLElement | null); if (!host) return;
    const r = host.getBoundingClientRect(); const x0 = e.clientX; const y0 = e.clientY;
    const g0 = p.geom as { x: number; y: number; scale: number }; let last = { x: g0.x, y: g0.y, scale: g0.scale };
    const boxW = (p.w / frame.width) * r.width;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0; const dy = ev.clientY - y0;
      last = mode === 'move' ? { x: g0.x + (dx / r.width) * 100, y: g0.y + (dy / r.height) * 100, scale: g0.scale } : { x: g0.x, y: g0.y, scale: Math.min(4, Math.max(0.1, g0.scale * (boxW + dx) / Math.max(20, boxW))) };
      setDraft(last);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setDraft(null); onGeometry?.(overlay.id, { x: Math.round(last.x * 10) / 10, y: Math.round(last.y * 10) / 10, scale: Math.round(last.scale * 100) / 100 }); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const grip: CSSProperties = { position: 'absolute', pointerEvents: 'auto', background: 'rgba(8,11,17,.82)', color: '#d9ff00', border: '1px solid #d9ff00', fontSize: 11, lineHeight: 1, padding: '3px 7px', borderRadius: 6, userSelect: 'none', touchAction: 'none' };
  return (
    <div data-hf-handle-root style={{ position: 'absolute', inset: 0, zIndex: 7, pointerEvents: 'none' }}>
      <div data-testid="hf-handle-box" style={{ position: 'absolute', left: pct(p.left, frame.width), top: pct(p.top, frame.height), width: pct(p.w, frame.width), height: pct(p.h, frame.height), outline: '1.5px dashed rgba(217, 255, 0,.85)', pointerEvents: 'none' }}>
        <div data-testid="hf-handle-move" title="Drag to move" onPointerDown={start('move')} style={{ ...grip, left: 6, top: 6, cursor: 'move' }}>✥ Move</div>
        <div data-testid="hf-handle-scale" title="Drag to resize" onPointerDown={start('scale')} style={{ ...grip, right: 4, bottom: 4, width: 12, height: 12, padding: 0, borderRadius: 3, cursor: 'nwse-resize' }} />
      </div>
    </div>
  );
}

export function OverlayLayer({ overlays, currentTime, isPlaying, previewPlaying, onPause, onResume, onEditText, onGeometry, frame = { width: 1280, height: 720 } }: Props) {
  const currentTimeRef = useRef(currentTime); currentTimeRef.current = currentTime;
  const hostRef = useRef<HTMLDivElement>(null);
  const addonRef = useRef<HTMLDivElement>(null);
  const selected = useSelectedOverlay();
  const dismissed = useRef(new Set<string>());
  // the form that is holding playback right now: it stays a solid wall (not the see-through editing preview) until it is done
  const gating = useRef<string | null>(null);
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;
  const addonPlaying = previewPlaying ?? isPlaying; // add-ons may animate while the forms stay in their non-interactive preview mode
  const active = overlaysAt(overlays, currentTime);
  const signature = active.map((o) => `${o.id}:${JSON.stringify(o)}`).join('|');

  // A form shows again when the playhead is moved back before it.
  useEffect(() => {
    for (const o of overlays) if (currentTime < o.start) dismissed.current.delete(o.id);
  }, [currentTime, overlays]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // the form's styles are scoped to .addon-overlay-layer and size themselves from --ovl-w (the frame width in px)
    host.style.setProperty('--ovl-w', `${host.clientWidth}px`);
    host.style.setProperty('--ovl-h', `${host.clientHeight}px`);
    host.replaceChildren();
    let gated = false;
    for (const o of active) {
      if (dismissed.current.has(o.id)) continue;
      const done = () => {
        dismissed.current.add(o.id);
        if (gating.current === o.id) {
          gating.current = null;
          // the form that held the video is through: carry on playing
          if (!playingRef.current) onResume?.();
        }
      };
      const live = isPlaying || gating.current === o.id;
      if (o.type === 'lead-form') {
        showLeadForm(host, o, { preview: !live, onEditText: onEditText ? (key: string, value: string) => onEditText(o.id, key, value) : undefined, onSubmit: async (data: Record<string, unknown>) => { const r = await sendLead(o, data); done(); return r; }, onSkip: done });
        gated = true; if (isPlaying) gating.current ??= o.id;
      } else if (o.type === 'list-builder') {
        showListBuilderOverlay(host, normalizeListBuilder({ ...(o.config as object) }), { preview: !live, onEditText: onEditText ? (key: string, value: string) => onEditText(o.id, key, value) : undefined, onSubmit: async (data: Record<string, unknown>) => { await sendLead(o, data); done(); return String((o.config as { successMessage?: string } | undefined)?.successMessage ?? 'Thanks!'); }, onSkip: done });
        gated = true; if (isPlaying) gating.current ??= o.id;
      } else if (o.type === 'click-to-call') {
        const style = (o.style ?? {}) as { buttonColor?: string };
        const a = document.createElement('a');
        const phone = String(o.phoneNumber ?? '').replace(/[^0-9+]/g, '');
        const link = String(o.linkUrl ?? '').trim();
        a.textContent = String(o.buttonText ?? 'Call Now');
        a.href = phone ? `tel:${phone}` : /^https?:\/\//i.test(link) ? link : '#';
        if (!phone && link) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        // same box the export draws (ctaBox: centre posLeft/posTop, width posWidth, 3:1 button), so preview and MP4 agree
        const box = ctaBox((o.style ?? {}) as Record<string, unknown>, frame.width / frame.height);
        Object.assign(a.style, {
          position: 'absolute', left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
          borderRadius: '999px', fontWeight: '700', textDecoration: 'none', fontSize: `${Math.max(10, box.height * 0.34 * (host.clientHeight || 400) / 100)}px`,
          background: style.buttonColor || '#eb5054', color: String(o.textColor ?? '#fff'), fontFamily: `"${o.fontFamily ?? 'Montserrat'}", system-ui, sans-serif`,
        });
        host.appendChild(a);
      }
    }
    if (gated && isPlaying) onPause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, isPlaying]);

  // Add-on overlays (text, images, stickers, wrapper, lower thirds): the old renderer builds the elements; positioned ones get
  // drag / resize handles when selected, and the geometry is saved back (kept in % of the frame).
  const addonSignature = active.filter((o) => isRegistryOverlay(o.type)).map((o) => `${o.id}:${JSON.stringify(o.addon)}:${selected === o.id}`).join('|');
  useEffect(() => {
    const layer = addonRef.current;
    if (!layer) return;
    layer.style.setProperty('--ovl-w', `${layer.clientWidth}px`);
    layer.style.setProperty('--ovl-h', `${layer.clientHeight}px`);
    [...layer.children].forEach((c) => destroyOverlayElement(c));
    const cleanups: Array<() => void> = [];
    for (const o of active.filter((x) => isRegistryOverlay(x.type))) {
      const el = buildOverlayElement(o, { editor: true }) as HTMLElement | null;
      if (!el) continue;
      layer.appendChild(el);
      void finishOverlayElement(el, { playing: addonPlaying });
      el.addEventListener('pointerdown', () => selectOverlay(o.id));
      const geometry = (o.addon as { geometry?: Record<string, number> } | undefined)?.geometry;
      if (selected === o.id && geometry && o.type !== 'overlay-background' && o.type !== 'overlay-text-mask') {
        const detach = attachDragResize(el, layer, {
          geometry,
          preserveRatio: o.type === 'overlay-image' || o.type === 'overlay-sticker',
          onCommit: (g: Record<string, number>) => onGeometry?.(o.id, g),
        });
        if (typeof detach === 'function') cleanups.push(detach);
      }
    }
    return () => { cleanups.forEach((c) => c()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addonSignature]);
  useEffect(() => {
    const layer = addonRef.current;
    if (!layer) return;
    const times = new Map(active.map((o) => [String(o.id), { start: o.start, duration: o.end - o.start }]));
    syncOverlayTime(layer, currentTime, times, { playing: addonPlaying });
    setOverlayPlaying(layer, addonPlaying);
  }, [currentTime, addonPlaying, addonSignature]);
  // Release the add-on renderers (Lottie, GL, media) when the layer goes away: the effect above only does that when it rebuilds.
  useEffect(() => {
    const layer = addonRef.current;
    return () => { if (layer) [...layer.children].forEach((c) => destroyOverlayElement(c)); };
  }, []);

  // [remix] OpenChatCut motion-graphics templates: shown by the editor's sandboxed code-preview frame (never run in this page).
  const mgRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<{ update: (m: unknown) => Promise<void>; frame: (f: number) => void; destroy: () => void } | null>(null);
  const mgOverlays = overlays.filter((o) => o.type === 'mg-template');
  // [hyperframes] verified HyperFrames animations share the same sandboxed preview frame
  const hfOverlays = overlays.filter((o) => o.type === 'hyperframes');
  const mgKey = JSON.stringify([frame.width, frame.height, mgOverlays.map((o) => [o.id, o.start, o.end, o.code, o.props]), ...(hfOverlays.length ? [hfOverlays.map((o) => [o.id, o.start, o.end, o.blockId, o.props, o.geom])] : [])]);
  useEffect(() => {
    const host = mgRef.current;
    if (!host) return;
    if (!mgOverlays.length && !hfOverlays.length) { previewRef.current?.destroy(); previewRef.current = null; return; }
    let live = true;
    void import('../../../lib/editor/remotion/codePreviewClient.js').then(({ createCodePreview }: { createCodePreview: (h: HTMLElement, o?: { onError?: (layerId: string, message: string) => void }) => NonNullable<typeof previewRef.current> }) => {
      if (!live) return;
      previewRef.current ??= createCodePreview(host, { onError: (layerId: string, message: string) => { if (String(message).startsWith('[hyperframes:')) void import('../../lib/hyperframes/notify').then((m) => m.notifyHyperframes({ id: `hf:${layerId}`, title: 'Animation', message: m.stripHfPrefix(message) })); } });
      const fps = 30;
      const layers = [...mgOverlays.map((o) => mgOverlayLayer(o, fps)), ...hfOverlays.map((o) => hyperframesOverlayLayer(o, fps))];
      // the frame effect below ran before this client existed, so seek again once the model is in (a still frame would otherwise stay at frame 0)
      void previewRef.current.update({ version: 1, fps, width: frame.width, height: frame.height, durationInFrames: Math.max(1, ...layers.map((l) => l.from + l.durationInFrames)), background: 'transparent', layers, audio: [], transitions: [], fonts: [] }).then(() => { if (live) previewRef.current?.frame(Math.round(currentTimeRef.current * 30)); });
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mgKey]);
  useEffect(() => () => { previewRef.current?.destroy(); previewRef.current = null; }, []);
  useEffect(() => { previewRef.current?.frame(Math.round(currentTime * 30)); }, [currentTime, mgKey]);

  void GATES;
  return (
    <>
      <div ref={addonRef} className="addon-overlay-layer" style={{ zIndex: 5 }} />
      <div ref={mgRef} style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none' }} />
      <div ref={hostRef} className="addon-overlay-layer wf-layer" style={{ zIndex: 6 }} />
      {active.filter((o) => o.type === 'hyperframes' && selected === o.id).map((o) => <HfHandle key={o.id} overlay={o} frame={frame} onGeometry={onGeometry} />)}
    </>
  );
}
