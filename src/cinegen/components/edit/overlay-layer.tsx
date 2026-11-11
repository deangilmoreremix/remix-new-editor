// [remix] Draws the overlays (Lead Generator, List Builder, CTA) over the video at the playhead. The forms are the old editor's own
// renderers (publish/viewerOverlays.js `showLeadForm`, addons/addonOverlay.js `showListBuilderOverlay`), so they keep the old look
// (red button, rounded black card). A form that gates playback pauses the video until it is submitted or skipped.
import { useEffect, useRef } from 'react';
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS renderers from the main app
import { showLeadForm } from '../../../lib/editor/publish/viewerOverlays.js';
// @ts-expect-error plain JS renderers from the main app
import { showListBuilderOverlay } from '../../../lib/editor/addons/addonOverlay.js';
// @ts-expect-error plain JS lead helpers
import { postWebhooksDirect, webhookUrlsFor } from '../../../lib/editor/addons/leadClient.js';
// @ts-expect-error plain JS add-on renderers (Smart Text, Text Mask, Image, Personalized Image, Stickers, Wrapper, Lower Thirds)
import { buildOverlayElement, finishOverlayElement, destroyOverlayElement, syncOverlayTime, setOverlayPlaying } from '../../../lib/editor/addons/overlayRender.js';
// @ts-expect-error plain JS drag / resize handles
import { attachDragResize } from '../../../lib/editor/addons/dragResize.js';
// @ts-expect-error plain JS: the same CTA box helper the export uses
import { ctaBox } from '../../../lib/editor/addons/ctaLottie.js';
import { mgOverlayLayer } from '@cinegen/lib/occ/mg-templates';
import { overlaysAt, isRegistryOverlay } from '@cinegen/lib/overlays/overlays';
import { hyperframesOverlayLayer } from '@cinegen/lib/hyperframes/overlay';
import { useSelectedOverlay, selectOverlay } from '@cinegen/lib/overlays/selection';
import '../../../../styles/timeline-addons.css';
import '../../../../styles/watch.css';

interface Props { overlays: OverlayClip[]; currentTime: number; isPlaying: boolean; onPause: () => void; onGeometry?: (id: string, geometry: Record<string, number>) => void; frame?: { width: number; height: number } }

const GATES = new Set(['lead-form', 'list-builder']);

async function sendLead(o: OverlayClip, data: Record<string, unknown>) {
  try {
    const key = `remix.cinegen.leads.${o.id}`;
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...prev, { ...data, submittedAt: new Date().toISOString() }]));
  } catch { /* storage unavailable */ }
  const cfg = (o.type === 'list-builder' ? o.config : o) as Record<string, unknown>;
  const urls = webhookUrlsFor(o.type === 'list-builder' ? { webhookEnabled: cfg.webhookEnabled, webhooks: [cfg.webhook, cfg.webhook2, cfg.webhook3] } : cfg) as string[];
  if (urls?.length) await postWebhooksDirect(urls, data);
  return { ok: true };
}

export function OverlayLayer({ overlays, currentTime, isPlaying, onPause, onGeometry, frame = { width: 1280, height: 720 } }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const addonRef = useRef<HTMLDivElement>(null);
  const selected = useSelectedOverlay();
  const dismissed = useRef(new Set<string>());
  const active = overlaysAt(overlays, currentTime);
  const signature = active.map((o) => `${o.id}:${JSON.stringify(o)}`).join('|');

  // A form shows again when the playhead is moved back before it.
  useEffect(() => {
    for (const o of overlays) if (currentTime < o.start) dismissed.current.delete(o.id);
  }, [currentTime, overlays]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    let gated = false;
    for (const o of active) {
      if (dismissed.current.has(o.id)) continue;
      const done = () => { dismissed.current.add(o.id); };
      if (o.type === 'lead-form') {
        showLeadForm(host, o, { onSubmit: async (data: Record<string, unknown>) => { const r = await sendLead(o, data); done(); return r; }, onSkip: done });
        gated = true;
      } else if (o.type === 'list-builder') {
        showListBuilderOverlay(host, o.config, { onSubmit: async (data: Record<string, unknown>) => { await sendLead(o, data); done(); return 'Thanks!'; }, onSkip: done });
        gated = true;
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
      void finishOverlayElement(el, { playing: isPlaying });
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
    syncOverlayTime(layer, currentTime, times, { playing: isPlaying });
    setOverlayPlaying(layer, isPlaying);
  }, [currentTime, isPlaying, addonSignature]);

  // [remix] OpenChatCut motion-graphics templates: shown by the editor's sandboxed code-preview frame (never run in this page).
  const mgRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<{ update: (m: unknown) => Promise<void>; frame: (f: number) => void; destroy: () => void } | null>(null);
  const mgOverlays = overlays.filter((o) => o.type === 'mg-template');
  // [hyperframes] verified HyperFrames animations share the same sandboxed preview frame
  const hfOverlays = overlays.filter((o) => o.type === 'hyperframes');
  const mgKey = JSON.stringify([frame.width, frame.height, mgOverlays.map((o) => [o.id, o.start, o.end, o.code, o.props]), ...(hfOverlays.length ? [hfOverlays.map((o) => [o.id, o.start, o.end, o.blockId, o.props])] : [])]);
  useEffect(() => {
    const host = mgRef.current;
    if (!host) return;
    if (!mgOverlays.length && !hfOverlays.length) { previewRef.current?.destroy(); previewRef.current = null; return; }
    let live = true;
    void import('../../../lib/editor/remotion/codePreviewClient.js').then(({ createCodePreview }: { createCodePreview: (h: HTMLElement, o?: { onError?: (layerId: string, message: string) => void }) => NonNullable<typeof previewRef.current> }) => {
      if (!live) return;
      previewRef.current ??= createCodePreview(host, { onError: (layerId: string, message: string) => { if (String(message).startsWith('[hyperframes:')) void import('../../lib/hyperframes/notify').then((m) => m.notifyHyperframes({ id: `hf:${layerId}`, title: 'HyperFrames animation', message: m.stripHfPrefix(message) })); } });
      const fps = 30;
      const layers = [...mgOverlays.map((o) => mgOverlayLayer(o, fps)), ...hfOverlays.map((o) => hyperframesOverlayLayer(o, fps))];
      void previewRef.current.update({ version: 1, fps, width: frame.width, height: frame.height, durationInFrames: Math.max(1, ...layers.map((l) => l.from + l.durationInFrames)), background: 'transparent', layers, audio: [], transitions: [], fonts: [] });
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
      <div ref={hostRef} className="wf-layer" style={{ zIndex: 6 }} />
    </>
  );
}
