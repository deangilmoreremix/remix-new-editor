import { useEffect, useRef } from 'react';
import type { OverlayClip } from '@/types/timeline';
import { isGateKind, overlayConfig } from '@/lib/optin/overlay-kinds';
import { clearOverlay, showOptinOverlay } from '@/lib/optin/addonOverlay.js';
import { postWebhooksDirect, isValidWebhookUrl } from '@/lib/optin/leadClient.js';

interface OptinViewerLayerProps {
  overlays: OverlayClip[];
  currentTime: number;
  isPlaying: boolean;
  selectedId: string | null;
  /** Pause / resume the timeline player. */
  pause: () => void;
  play: () => void;
  /** Called with what the viewer typed (editor preview: webhooks only, nothing is stored). */
  onLead?: (overlay: OverlayClip, data: Record<string, string>) => void;
}

const NAME = 'optin';
/** Seconds the playhead may jump before it counts as a seek (re-arms forms). */
const SEEK_TOLERANCE = 0.75;

/**
 * Draws the opt-in form over the timeline viewer and runs its gate logic
 * (same rules as upstream's List Builder / Lead Generator):
 *  - List Builder / Personalizer: a wall at 0s. Playing from the start pauses on
 *    it until the form is submitted (or skipped, if Skip is on).
 *  - Lead Generator: pauses when the playhead reaches its start; never shows again once done.
 * While stopped, a selected overlay is previewed (see-through) so it can be styled.
 */
export function OptinViewerLayer({ overlays, currentTime, isPlaying, selectedId, pause, play, onLead }: OptinViewerLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const done = useRef<Set<string>>(new Set());
  const gating = useRef<string | null>(null);
  const lastTime = useRef(0);
  const shownSig = useRef('');
  const latest = useRef({ pause, play, onLead });
  latest.current = { pause, play, onLead };

  // Pixel width the form's em-based sizing is derived from.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => layer.style.setProperty('--ovl-w', `${layer.clientWidth}px`));
    ro.observe(layer);
    layer.style.setProperty('--ovl-w', `${layer.clientWidth}px`);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const prev = lastTime.current;
    lastTime.current = currentTime;

    // A scrub/rewind re-arms every form that is now ahead of the playhead.
    if (Math.abs(currentTime - prev) > SEEK_TOLERANCE) {
      for (const o of overlays) {
        if (o.start >= currentTime || (isGateKind(o.kind) && currentTime <= 0.15)) done.current.delete(o.id);
      }
    }

    const finish = (o: OverlayClip, data?: Record<string, string>) => {
      done.current.add(o.id);
      gating.current = null;
      shownSig.current = '';
      clearOverlay(layer, NAME);
      if (data) latest.current.onLead?.(o, data);
      latest.current.play();
    };

    const show = (o: OverlayClip, preview: boolean) => {
      const cfg = overlayConfig(o);
      const sig = `${o.id}|${preview ? 'p' : 'g'}|${JSON.stringify(cfg)}`;
      if (shownSig.current === sig && layer.querySelector(`[data-overlay="${NAME}"]`)) return;
      shownSig.current = sig;
      showOptinOverlay(layer, cfg, {
        name: NAME,
        preview,
        onSkip: () => finish(o),
        onSubmit: async (data: Record<string, string>) => {
          const urls = [cfg.webhook, cfg.webhook2, cfg.webhook3]
            .map((u) => (typeof u === 'string' ? u : (u as { value?: string } | undefined)?.value ?? ''))
            .filter((u) => cfg.webhookEnabled && isValidWebhookUrl(u));
          if (urls.length) postWebhooksDirect(urls, { event: 'video_opted_in', kind: o.kind, data }).catch(() => undefined);
          if (!preview) finish(o, data);
          else { clearOverlay(layer, NAME); shownSig.current = ''; latest.current.onLead?.(o, data); }
          return '';
        },
      });
    };

    // 1. A gate that should be holding playback right now.
    if (!gating.current && isPlaying) {
      const trigger = overlays.find((o) => {
        if (done.current.has(o.id)) return false;
        if (isGateKind(o.kind)) return currentTime <= 0.15;
        return currentTime >= o.start && currentTime < o.end;
      });
      if (trigger) {
        gating.current = trigger.id;
        latest.current.pause();
        show(trigger, false);
        return;
      }
    }

    // 2. A gate is open: keep it, and keep it in sync with edits.
    if (gating.current) {
      const g = overlays.find((o) => o.id === gating.current);
      if (g) show(g, false);
      else { gating.current = null; clearOverlay(layer, NAME); shownSig.current = ''; }
      return;
    }

    // 3. Stopped: preview the selected overlay so it can be designed.
    if (!isPlaying && selectedId) {
      const sel = overlays.find((o) => o.id === selectedId);
      if (sel) { show(sel, true); return; }
    }
    if (shownSig.current) { clearOverlay(layer, NAME); shownSig.current = ''; }
  }, [overlays, currentTime, isPlaying, selectedId]);

  return <div ref={layerRef} className="addon-overlay-layer optin-viewer-layer" data-testid="optin-viewer-layer" />;
}
