// [remix] "Get the interactive version" end card for MP4 viewers: a plain video can't hold a form, so the last seconds show a QR code
// and the link to the published page (where the List Builder / Lead Generator work). Built from ordinary overlays (background, text,
// image) so it is fully editable and is drawn into the MP4 export like any End Screen.
import QRCode from 'qrcode';
import type { OverlayClip } from '@cinegen/types/workspace';
import { createOverlay } from '@cinegen/lib/overlays/overlays';
// @ts-expect-error plain JS add-on option helpers
import { watchUrl } from '../../../lib/editor/publish/publishClient.js';

export const MP4_SOURCE_TAG = 'mp4';
export const QR_CARD_SECONDS = 6;

/** The published link MP4 viewers are sent to; `?src=mp4` lets the Leads tab tell where a lead came from. */
export const mp4WatchLink = (id: string, origin?: string): string => `${origin ? watchUrl(id, origin) : watchUrl(id)}?src=${MP4_SOURCE_TAG}`;

export const qrDataUrl = (url: string): Promise<string> =>
  QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#07090d', light: '#ffffff' } });

const patch = (clip: OverlayClip, start: number, end: number, name: string, addon: Record<string, unknown>): OverlayClip => ({
  ...clip, name, start, end, addon: { ...((clip.addon as Record<string, unknown>) ?? {}), ...addon },
});

/** Overlay clips for the end card, placed in the last QR_CARD_SECONDS of the timeline. */
export async function createQrEndCard(link: string, timelineSeconds: number): Promise<OverlayClip[]> {
  const dur = Math.min(QR_CARD_SECONDS, Math.max(2, timelineSeconds));
  const start = Math.max(0, timelineSeconds - dur);
  const end = Math.max(start + 0.5, timelineSeconds);
  const src = await qrDataUrl(link);
  const display = link.replace(/^https?:\/\//, '').replace(/\?src=.*$/, '');
  const bg = createOverlay('overlay-background', start, timelineSeconds);
  const head = createOverlay('overlay-text', start, timelineSeconds);
  const qr = createOverlay('overlay-image', start, timelineSeconds);
  const url = createOverlay('overlay-text', start, timelineSeconds);
  const text = (v: string, geometry: Record<string, number>, size: number, color: string, bold: boolean) => ({
    text: v, geometry, position: 'custom', alignment: 'center', fontSize: size, fontColor: color,
    fontDecorations: { bold, italics: false, responsive: true }, rotation: 0, opacity: 100,
  });
  return [
    patch(bg, start, end, 'QR end card background', { background: '#07090d', styles: 'background: linear-gradient(160deg, #07090d 0%, #10202a 60%, #0b3440 100%);', opacity: 100 }),
    patch(head, start, end, 'QR end card headline', text('Want the interactive version?', { left: 10, top: 8, width: 80, height: 14 }, 8, '#FFFFFF', true)),
    patch(qr, start, end, 'QR code', { src, title: 'Scan to open the interactive video', geometry: { left: 36, top: 26, width: 28, height: 50 }, cornerRadius: true, opacity: 100 }),
    patch(url, start, end, 'QR end card link', text(`Scan the code or go to ${display}`, { left: 10, top: 80, width: 80, height: 10 }, 5, '#22d3ee', false)),
  ];
}
