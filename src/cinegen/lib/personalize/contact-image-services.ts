// [remix] What the overlay settings need to work with a contact's pictures (Personalized Image): one button per image token showing the
// contact's real picture, the image finder's results as one-click picks, the crop focus and "Make Video Ready". Ported from the classic
// editor's settings services (TimelineEditorPage.jsx addonEditorServices), using the same helpers and the same contact store.
// @ts-expect-error plain JS contact store (localStorage)
import * as contactStore from '../../../lib/contactStore.js';
// @ts-expect-error plain JS per-contact helpers
import { contactName } from '../../../lib/editor/personalize/perContact.js';
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
const announce = (id: string) => { try { window.dispatchEvent(new CustomEvent('remix:contact-changed', { detail: { contactId: id } })); } catch { /* no window */ } };

function saveContactAsset(profile: Profile, assetId: string, updater: (a: Record<string, unknown>) => Record<string, unknown>) {
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
  saveContactAsset((contactStore.getProfile?.(profile.id) as Profile) || profile, logo.id, (a) => ({ ...a, luminance: lum }));
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
        profile = addPersonalizationAsset(profile, imported);
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
    makeVideoReady: async (src: string, redraw?: () => void) => {
      const profile = active();
      const key = imageTokenOf(src);
      const asset = profile && key ? assetForImageToken(profile, key) : null;
      if (!profile || !asset?.url || asset.videoReady || busy.has(asset.id)) return false;
      busy.add(asset.id); redraw?.();
      const business = (profile as { personalization?: { business?: Record<string, string> } }).personalization?.business || {};
      try {
        const result = await makePersonalizationAssetVideoReady(asset, { businessContext: { businessName: business.businessName, industry: business.industry, productService: business.productService, brandDescription: business.brandDescription } });
        const stored = await persistPersonalizationAssetVersion({ sourceUrl: result.url, role: asset.role, name: `${asset.name || asset.role} — Video Ready` });
        const fresh = (contactStore.getProfile?.(profile.id) as Profile) || profile;
        saveContactAsset(fresh, asset.id, (a) => ({
          ...a, ...result, url: stored.url, originalUrl: (a as { originalUrl?: string }).originalUrl || asset.url, luminance: undefined,
          versions: [...(Array.isArray((a as { versions?: unknown[] }).versions) ? (a as { versions: unknown[] }).versions : []), { id: `${a.id}:video-ready:${Date.now()}`, url: stored.url, type: 'video_ready', createdAt: new Date().toISOString() }],
        }));
        if (key === 'logoUrl') void measureLogoFor((contactStore.getProfile?.(profile.id) as Profile) || fresh);
        host.notify(`${contactName(profile)}'s ${key === 'avatarUrl' ? 'photo' : 'image'} is Video Ready.`, 'success');
        return true;
      } catch (err) {
        const e = err as { code?: string; message?: string };
        host.notify(e?.code === 'VISION_QA_REVIEW_REQUIRED' ? `Video Ready needs a review for ${contactName(profile)}: open the Personalize window's image finder to check it.` : `Video Ready failed for ${contactName(profile)}: ${e?.message || err}`, 'error');
        return false;
      } finally { busy.delete(asset.id); redraw?.(); }
    },
  };
}
