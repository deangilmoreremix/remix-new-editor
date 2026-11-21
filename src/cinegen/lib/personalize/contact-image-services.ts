// [remix] What the overlay settings need to work with a contact's pictures (Personalized Image): one button per image token showing the
// contact's real picture, the image finder's results as one-click picks, the crop focus and "Make Video Ready". Ported from the classic
// editor's settings services (TimelineEditorPage.jsx addonEditorServices), using the same helpers and the same contact store.
// @ts-expect-error plain JS contact store (localStorage)
import * as contactStore from '../../../lib/contactStore.js';
// @ts-expect-error plain JS per-contact helpers
import { contactName, listContactProfiles } from '../../../lib/editor/personalize/perContact.js';
// @ts-expect-error plain JS image helpers
import { assetForImageToken, imageTokenChoices, imageTokenOf, listTimelineImageAssets } from '../../../lib/personalization/timelineAssets.js';
// @ts-expect-error plain JS profile helpers
import { addPersonalizationAsset, setDiscoveredPersonalizationAssets, updatePersonalizationAsset } from '../../../lib/personalization/personalizationProfile.js';
// @ts-expect-error plain JS asset service
import { importDiscoveredAsset, persistPersonalizationAssetVersion } from '../../../lib/personalization/assetDiscoveryService.js';
// @ts-expect-error plain JS Video Ready cleanup
import { makePersonalizationAssetVideoReady } from '../../../lib/personalization/videoReady.js';
// @ts-expect-error plain JS luminance for logo backing plates
import { measureImageLuminance } from '../../../lib/personalization/imageStyle.js';

type Profile = Record<string, unknown> & { id: string };
export interface ImageHost { notify: (message: string, kind?: 'info' | 'error' | 'success') => void }

const active = (): Profile | null => contactStore.getActiveProfile() as Profile | null;
/** Saved contact data changed: the preview (and any other listener) redraws. */
export const announce = (id: string) => { try { window.dispatchEvent(new CustomEvent('remix:contact-changed', { detail: { contactId: id } })); } catch { /* no window */ } };

export function saveContactAsset(profile: Profile, assetId: string, updater: (a: Record<string, unknown>) => Record<string, unknown>) {
  if (!profile || !assetId) return null;
  const saved = contactStore.saveProfile(updatePersonalizationAsset(profile, assetId, updater));
  announce(profile.id);
  return saved;
}

const busy = new Set<string>();
const measuring = new Set<string>();

/** Measure the brightness of a contact's logo once, so a "Backing: Auto" plate suits it (light logos get a dark plate). */
export async function measureLogoFor(profile: Profile | null): Promise<void> {
  const logo = profile ? assetForImageToken(profile, 'logoUrl') : null;
  if (!profile || !logo?.url || logo.luminance != null || measuring.has(logo.url)) return;
  measuring.add(logo.url);
  const lum = await measureImageLuminance(logo.url);
  measuring.delete(logo.url);
  if (lum == null) return;
  // the logo may have been replaced (Video Ready) while this was measured: only keep a measurement of the picture that is still there
  const fresh = contactStore.getProfile?.(profile.id) as Profile | null;
  if (!fresh) return; // the contact was deleted meanwhile
  if ((assetForImageToken(fresh, 'logoUrl') as { url?: string } | null)?.url !== logo.url) return;
  saveContactAsset(fresh, logo.id, (a) => ({ ...a, luminance: lum }));
}

/** Measure the logo of the contact being previewed (after a layout added a logo with an Auto backing). */
export const measureActiveLogo = (): Promise<void> => measureLogoFor(active());

/** "Make Video Ready" for one contact's picture: the image finder's cleanup (background removal, fixes, checked by Vision QA), on the
 *  user's own OpenAI key. Resolves true when the picture is now Video Ready; says why in `notify` when it is not. */
export async function makeContactImageVideoReady(profile: Profile, key: string, notify: ImageHost['notify'], redraw?: () => void): Promise<boolean> {
  const asset = key ? assetForImageToken(profile, key) : null;
  if (!profile || !asset?.url || asset.videoReady || busy.has(asset.id)) return false;
  busy.add(asset.id); redraw?.();
  const business = (profile as { personalization?: { business?: Record<string, string> } }).personalization?.business || {};
  try {
    const result = await makePersonalizationAssetVideoReady(asset, { businessContext: { businessName: business.businessName, industry: business.industry, productService: business.productService, brandDescription: business.brandDescription } });
    const stored = await persistPersonalizationAssetVersion({ sourceUrl: result.url, role: asset.role, name: `${asset.name || asset.role} — Video Ready` });
    const fresh = contactStore.getProfile?.(profile.id) as Profile | null;
    if (!fresh) return false; // the contact was deleted while this ran: drop the result instead of bringing the contact back
    if ((assetForImageToken(fresh, key) as { id?: string } | null)?.id !== asset.id) { // the picture was removed or replaced meanwhile: nothing to save
      notify(`The picture for ${contactName(profile)} changed while Video Ready ran, so the result was not saved.`, 'error');
      return false;
    }
    // only what the cleanup produced is applied, so a crop focus or an approval changed meanwhile survives
    const changed = Object.fromEntries(Object.entries(result as Record<string, unknown>).filter(([k, v]) => v !== (asset as Record<string, unknown>)[k]));
    saveContactAsset(fresh, asset.id, (a) => ({
      ...a, ...changed, url: stored.url, originalUrl: (a as { originalUrl?: string }).originalUrl || asset.url, luminance: undefined,
      versions: [...(Array.isArray((a as { versions?: unknown[] }).versions) ? (a as { versions: unknown[] }).versions : []), { id: `${a.id}:video-ready:${Date.now()}`, url: stored.url, type: 'video_ready', createdAt: new Date().toISOString() }],
    }));
    if (key === 'logoUrl') void measureLogoFor(contactStore.getProfile?.(profile.id) as Profile | null);
    notify(`${contactName(profile)}'s ${key === 'avatarUrl' ? 'photo' : 'image'} is Video Ready.`, 'success');
    return true;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    notify(e?.code === 'VISION_QA_REVIEW_REQUIRED' ? `Video Ready needs a review for ${contactName(profile)}: open the Personalize window's image finder to check it.` : `Video Ready failed for ${contactName(profile)}: ${e?.message || err}`, 'error');
    return false;
  } finally { busy.delete(asset.id); redraw?.(); }
}

export interface AllVideoReadyResult { total: number; done: number; message: string }

/** The image tokens the timeline's Personalized Images use (what "Make all Video Ready" works on). */
export const personalizedImageKeys = (overlays: Array<{ type: string; addon?: unknown }>): string[] => [...new Set(
  overlays.filter((o) => o.type === 'overlay-personalized-image').map((o) => imageTokenOf((o.addon as { src?: string } | undefined)?.src)).filter(Boolean),
)] as string[];

/** "Make all Video Ready": every contact's picture for the slots this video uses, one after the other (each call is a paid AI cleanup). */
export async function makeAllVideoReady(overlays: Array<{ type: string; addon?: unknown }>, host: ImageHost & { onProgress?: (done: number, total: number, who: string) => void }): Promise<AllVideoReadyResult> {
  const keys = personalizedImageKeys(overlays);
  if (!keys.length) return { total: 0, done: 0, message: 'Add a Personalized Image (or a personalized layout) first.' };
  const jobs: Array<[Profile, string]> = [];
  (listContactProfiles(contactStore) as Profile[]).forEach((p) => keys.forEach((key) => {
    const asset = assetForImageToken(p, key);
    if (asset?.url && !asset.videoReady) jobs.push([p, key]);
  }));
  if (!jobs.length) return { total: 0, done: 0, message: 'Every contact image this video uses is already Video Ready.' };
  let done = 0;
  for (const [p, key] of jobs) {
    host.onProgress?.(done, jobs.length, contactName(p));
    const latest = contactStore.getProfile?.(p.id) as Profile | null;
    if (!latest) continue; // deleted while the batch ran: no paid cleanup for it
    if (await makeContactImageVideoReady(latest, key, host.notify)) done += 1;
  }
  host.onProgress?.(done, jobs.length, '');
  return { total: jobs.length, done, message: `${done} of ${jobs.length} images are now Video Ready${done < jobs.length ? '. The rest need a look in the image finder (or an OpenAI key in Settings).' : '.'}` };
}

export function contactImageServices(host: ImageHost) {
  return {
    imageTokens: () => imageTokenChoices(active()),
    contactLabel: () => { const p = active(); return p ? (contactName(p) as string) : ''; },
    finderImages: () => listTimelineImageAssets(active()),
    useFinderImage: async (index: number) => {
      const image = (listTimelineImageAssets(active()) as Array<{ saved?: boolean; discovered?: { id: string; altText?: string; category?: string }; src: string }>)[index];
      if (!image) return null;
      if (image.saved || !image.discovered) return image.src;
      let profile = active();
      try {
        const imported = await importDiscoveredAsset(image.discovered, { name: image.discovered.altText || image.discovered.category });
        // the contact may have changed while the picture was being saved: add to its latest version, never recreate a deleted one
        const latestProfile = contactStore.getProfile?.((profile as Profile).id) as Profile | null;
        if (!latestProfile) throw new Error('the contact was removed');
        profile = addPersonalizationAsset(latestProfile, imported);
        profile = setDiscoveredPersonalizationAssets(profile, ((profile as { personalization: { discoveredAssets?: Array<{ id: string }> } }).personalization.discoveredAssets || [])
          .map((c) => (c.id === image.discovered!.id ? { ...c, importedAssetId: imported.id, selected: false, importError: null } : c)));
        contactStore.saveProfile(profile);
        announce((profile as Profile).id);
        host.notify("Saved to the contact's images.", 'success');
        return imported.url as string;
      } catch (err) {
        host.notify(`Using the website copy of this image (${(err as Error)?.message || 'it could not be saved to the contact'}).`, 'info');
        return image.src;
      }
    },
    contactImage: (src: string) => {
      const profile = active();
      const key = imageTokenOf(src);
      const asset = key ? assetForImageToken(profile, key) : null;
      if (!profile || !asset?.url) return null;
      return {
        url: asset.url, focus: asset.focus || null, videoReady: Boolean(asset.videoReady), busy: busy.has(asset.id), contact: contactName(profile),
        label: (imageTokenChoices(profile) as Array<{ key: string; label: string }>).find((c) => c.key === key)?.label?.toLowerCase() || 'image',
      };
    },
    setImageFocus: (src: string, x: number, y: number) => {
      const profile = active();
      const key = imageTokenOf(src);
      const asset = profile && key ? assetForImageToken(profile, key) : null;
      if (profile && asset?.id) saveContactAsset(profile, asset.id, (a) => ({ ...a, focus: { x, y } }));
    },
    // "Make Video Ready": the image finder's cleanup (background removal, fixes, checked by Vision QA), on the user's own OpenAI key.
    makeVideoReady: (src: string, redraw?: () => void) => {
      const profile = active();
      const key = imageTokenOf(src);
      return profile && key ? makeContactImageVideoReady(profile, key, host.notify, redraw) : Promise.resolve(false);
    },
  };
}
