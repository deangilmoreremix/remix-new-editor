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
import { overlaysAt } from '@cinegen/lib/overlays/overlays';
import '../../../../styles/timeline-addons.css';
import '../../../../styles/watch.css';

interface Props { overlays: OverlayClip[]; currentTime: number; isPlaying: boolean; onPause: () => void }

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

export function OverlayLayer({ overlays, currentTime, isPlaying, onPause }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
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
        Object.assign(a.style, {
          alignSelf: 'flex-end', margin: '0 0 12% 0', padding: '12px 28px', borderRadius: '999px', fontWeight: '700', textDecoration: 'none',
          background: style.buttonColor || '#eb5054', color: String(o.textColor ?? '#fff'), fontFamily: `"${o.fontFamily ?? 'Montserrat'}", system-ui, sans-serif`,
        });
        host.appendChild(a);
      }
    }
    if (gated && isPlaying) onPause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, isPlaying]);

  void GATES;
  return <div ref={hostRef} className="wf-layer" style={{ zIndex: 6 }} />;
}
