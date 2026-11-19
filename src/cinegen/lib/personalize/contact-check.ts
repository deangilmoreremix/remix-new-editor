// [remix] "Check contacts": every contact's picture for the slots this video uses, with what to do about gaps. Ported from the classic
// editor (TimelineEditorPage.jsx openContactImageCheck / fillMissingWithAi) on the same helpers. Missing product / brand / opening /
// closing pictures can be made with AI from the contact's business details (logos, faces and CTA graphics never are); AI pictures stay
// "needs review" until someone approves them, and the Export tab warns until then.
// @ts-expect-error plain JS contact store (localStorage)
import * as contactStore from '../../../lib/contactStore.js';
// @ts-expect-error plain JS per-contact helpers
import { contactName, listContactProfiles } from '../../../lib/editor/personalize/perContact.js';
// @ts-expect-error plain JS image helpers
import { assetForImageToken, imageTokenChoices } from '../../../lib/personalization/timelineAssets.js';
// @ts-expect-error plain JS token schema (the same lookup the preview and export use)
import { resolveToken } from '../../../components/personalize/tokenSchema.js';
// @ts-expect-error plain JS AI picture planning and review state
import { markAiGenerated, needsReview, planAiImages } from '../../../lib/personalization/aiContactImages.js';
// @ts-expect-error plain JS profile helpers
import { addPersonalizationAsset, createPersonalizationAsset, removePersonalizationAsset } from '../../../lib/personalization/personalizationProfile.js';
// @ts-expect-error plain JS asset storage
import { persistPersonalizationAssetVersion } from '../../../lib/personalization/assetDiscoveryService.js';
// @ts-expect-error plain JS image generation (the user's OpenAI key)
import { generateImage } from '../../../lib/editor/aiImageService.js';
import { announce, saveContactAsset, personalizedImageKeys, type ImageHost } from './contact-image-services';

type Profile = Record<string, unknown> & { id: string };
export interface AiJob { contactId: string; contactName: string; key: string; label: string; role: string; prompt: string; aspectRatio: string }
export interface Skipped { contactName: string; label: string; reason: string }
export interface CheckCell { key: string; url: string | null; assetId: string | null; aiGenerated: boolean; needsReview: boolean; videoReady: boolean; aiPrompt: string | null }
export interface CheckRow { id: string; name: string; cells: CheckCell[] }
export interface ContactCheck { columns: Array<{ key: string; label: string }>; rows: CheckRow[]; jobs: AiJob[]; skipped: Skipped[]; fromTimeline: boolean }

/** The four main contact pictures, shown when the timeline has no Personalized Image yet. */
export const DEFAULT_CHECK_KEYS = ['logoUrl', 'avatarUrl', 'productImageUrl', 'ctaImageUrl'];

export function buildContactCheck(overlays: Array<{ type: string; addon?: unknown }>): ContactCheck {
  const used = personalizedImageKeys(overlays);
  const keys = used.length ? used : DEFAULT_CHECK_KEYS;
  const labels = Object.fromEntries((imageTokenChoices(null) as Array<{ key: string; label: string }>).map((c) => [c.key, c.label]));
  const contacts = listContactProfiles(contactStore) as Profile[];
  const rows = contacts.map((p) => ({
    id: p.id,
    name: contactName(p) as string,
    cells: keys.map((key): CheckCell => {
      const a = assetForImageToken(p, key) as { id?: string; url?: string; aiGenerated?: boolean; needsReview?: boolean; videoReady?: boolean; aiPrompt?: string } | null;
      // the picture the preview would show (an asset, or an older cached value), so a filled slot is never reported missing
      const shown = (resolveToken(p, key) as string | null) || a?.url || null;
      return { key, url: shown, assetId: a?.id ?? null, aiGenerated: !!a?.aiGenerated, needsReview: !!(a?.aiGenerated && a?.needsReview), videoReady: !!a?.videoReady, aiPrompt: a?.aiPrompt ?? null };
    }),
  }));
  const { jobs, skipped } = planAiImages(keys, contacts) as { jobs: AiJob[]; skipped: Skipped[] };
  return { columns: keys.map((key) => ({ key, label: labels[key] || key })), rows, jobs, skipped, fromTimeline: used.length > 0 };
}

/** AI pictures this video would show that nobody has approved yet, for one contact (the Export tab lists them as an issue). */
export const unreviewedFor = (profile: Profile, keys: string[]): string[] => keys.filter((k) => needsReview(profile, k));

/** The contact's AI picture is fine: it is no longer flagged for review. */
export function approveAiImage(contactId: string, assetId: string): boolean {
  const profile = contactStore.getProfile?.(contactId) as Profile | null;
  if (!profile) return false;
  saveContactAsset(profile, assetId, (a) => ({ ...a, needsReview: false, reviewedAt: new Date().toISOString() }));
  return true;
}

/** Take a picture off the contact (so a slot is empty again and can be filled). */
export function removeContactImage(contactId: string, assetId: string): boolean {
  const profile = contactStore.getProfile?.(contactId) as Profile | null;
  if (!profile) return false;
  const gone = ((profile.personalization as { assets?: Record<string, Array<{ id?: string; url?: string }>> } | undefined)?.assets);
  const url = gone ? Object.values(gone).flat().find((a) => a?.id === assetId)?.url : null;
  const next = removePersonalizationAsset(profile, assetId) as Profile;
  // saveProfile keeps `variables` as a seed, so a cached copy of the removed picture would keep showing in the preview and export
  if (url && next.variables) {
    next.variables = Object.fromEntries(Object.entries(next.variables as Record<string, unknown>).filter(([, v]) => v !== url));
  }
  contactStore.saveProfile(next);
  announce(contactId);
  return true;
}

/** Make the contact the one the editor previews as. */
export const previewAs = (contactId: string) => { contactStore.selectContact(contactId); };

/** Shrink a generated image before upload (PNG to JPEG, longest side 1600px) so the request stays inside the function size limit. */
export function compressDataUrl(dataUrl: string, { maxSide = 1600, quality = 0.9 } = {}): Promise<string> {
  return new Promise((resolve) => {
    if (!/^data:image\//.test(String(dataUrl))) { resolve(dataUrl); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export interface FillResult { made: number; total: number; message: string }

const inFlight = new Set<string>(); // contactId:slot being made now, so reopening the panel cannot start the same paid call twice

/** Make each missing picture with AI, one at a time, on the user's OpenAI key; each is saved on the contact as "AI, needs review".
 *  A sign-in or key problem fails every job the same way, so it stops early and says so. */
export async function fillMissingWithAi(jobs: AiJob[], host: ImageHost & { onProgress?: (text: string) => void }): Promise<FillResult> {
  let made = 0;
  const failures: string[] = [];
  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i];
    const slot = `${job.contactId}:${job.key}`;
    if (inFlight.has(slot)) continue;
    inFlight.add(slot);
    host.onProgress?.(`Making ${job.label} for ${job.contactName} (${i + 1} of ${jobs.length})…`);
    try {
      const result = await generateImage({ prompt: job.prompt, aspectRatio: job.aspectRatio, quality: 'medium', n: 1 }) as { ok?: boolean; error?: string; assets?: Array<{ url?: string; src?: string }> };
      const url = result?.ok ? (result.assets?.[0]?.url || result.assets?.[0]?.src) : null;
      if (!url) throw new Error(result?.error || 'No image came back');
      const stored = await persistPersonalizationAssetVersion({ sourceUrl: await compressDataUrl(url), role: job.role, name: `${job.label} (AI)` });
      const profile = contactStore.getProfile?.(job.contactId) as Profile | null;
      // someone may have added this picture while it was being made: keep theirs
      if (!profile || !(planAiImages([job.key], [profile]) as { jobs: AiJob[] }).jobs.length) continue;
      const asset = markAiGenerated(createPersonalizationAsset({
        role: job.role, name: `${job.label[0].toUpperCase()}${job.label.slice(1)} (AI)`, url: stored.url, sourceType: 'AI_GENERATED', mimeType: stored.mimeType || 'image/jpeg',
      }), { prompt: job.prompt });
      contactStore.saveProfile(addPersonalizationAsset(profile, asset));
      announce(job.contactId);
      made += 1;
    } catch (err) {
      const raw = String((err as Error)?.message || err);
      if (/sign in/i.test(raw)) { failures.push('Sign in to save AI images to your contacts'); break; }
      if (/key/i.test(raw)) { failures.push(raw); break; }
      failures.push(`${job.contactName}: ${raw}`);
    } finally { inFlight.delete(slot); }
  }
  const message = `Made ${made} of ${jobs.length} images with AI${made ? '. Review them before sending.' : '.'}${failures.length ? ` ${failures[0]}` : ''}`;
  host.onProgress?.(message);
  host.notify(message, failures.length && !made ? 'error' : 'success');
  return { made, total: jobs.length, message };
}
