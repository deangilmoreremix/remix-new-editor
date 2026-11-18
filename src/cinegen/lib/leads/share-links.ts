// [remix] Tracked share links: the published link plus campaign tags (utm_*), so the Leads tab's Source column shows where each lead came from.
// Attribution already reads utm_source / utm_medium / utm_campaign from the page the viewer submitted on.

export interface LinkPreset { id: string; label: string; source: string; medium: string; src?: string }

export const LINK_PRESETS: LinkPreset[] = [
  { id: 'email', label: 'Email', source: 'email', medium: 'email' },
  { id: 'newsletter', label: 'Newsletter', source: 'newsletter', medium: 'email' },
  { id: 'social', label: 'Social post', source: 'social', medium: 'social' },
  { id: 'qr', label: 'QR code / print', source: 'qr', medium: 'print' },
  { id: 'sms', label: 'Text message', source: 'sms', medium: 'sms' },
  { id: 'mp4', label: 'Exported MP4 (end card)', source: 'mp4', medium: 'video', src: 'mp4' },
];

/** A campaign tag: lower-case letters, digits, dash and underscore, up to 60 characters ("Spring Sale!" -> "spring-sale"). */
export const cleanTag = (v: string): string => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** `baseUrl` + the preset's tags (+ an optional campaign name). Existing query parameters are kept; a tag already on the link is replaced. */
export function trackedLink(baseUrl: string, presetId: string, campaign = ''): string {
  const preset = LINK_PRESETS.find((p) => p.id === presetId);
  if (!baseUrl || !preset) return baseUrl;
  let url: URL;
  try { url = new URL(baseUrl); } catch { return baseUrl; }
  url.searchParams.set('utm_source', preset.source);
  url.searchParams.set('utm_medium', preset.medium);
  const c = cleanTag(campaign);
  if (c) url.searchParams.set('utm_campaign', c); else url.searchParams.delete('utm_campaign');
  if (preset.src) url.searchParams.set('src', preset.src);
  return url.toString();
}
