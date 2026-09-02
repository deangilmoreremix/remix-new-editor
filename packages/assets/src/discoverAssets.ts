// packages/assets/src/discoverAssets.ts
//
// Orchestrator: given a contact's discovery inputs (Maigret scan result,
// GitHub user, crawled website HTML, profile record), produce a
// deduplicated set of asset records and optionally re-upload them to
// Supabase storage so the URLs are stable.

import type {
  AssetDiscoveryOptions,
  AssetDiscoveryResult,
  DiscoveredAsset,
} from './types.ts';
import {
  buildContactAssetPath,
  getStorageConfig,
  isStorageConfigured,
  mirrorToStorage,
  type StorageConfig,
} from './storage.ts';
import { detectLogoFromHtml, buildLogoAsset } from './extractors/logo.ts';
import { extractColorsFromHtml, mergeIntoBrandColors } from './extractors/colors.ts';
import { extractAvatars } from './extractors/avatar.ts';
import { captureScreenshot } from './extractors/screenshot.ts';

export interface DiscoverAssetsInput {
  contactId: string;
  userId: string;
  /** URL of the contact's website (best effort) */
  websiteUrl?: string;
  /** Raw HTML of the contact's website (preferred over crawling again) */
  websiteHtml?: string;
  /** Maigret scan result */
  maigret?: {
    platforms?: Array<{ platform?: string; ids_data?: Record<string, any> }>;
  };
  /** GitHub user data */
  github?: { avatar_url?: string; html_url?: string };
  /** Contact record (for manually-supplied avatar URL) */
  contact?: { avatarUrl?: string };
  /** Storage overrides */
  storage?: Partial<StorageConfig>;
  /** Discovery options */
  options?: AssetDiscoveryOptions;
}

const DEFAULT_OPTIONS: Required<AssetDiscoveryOptions> = {
  uploadToStorage: true,
  sourceOnly: false,
  timeoutMs: 10000,
  userAgent: 'Mozilla/5.0 (compatible; remix-new-editor-assets/1.0)',
  maxBytes: 5 * 1024 * 1024,
};

export async function discoverAssets(input: DiscoverAssetsInput): Promise<AssetDiscoveryResult> {
  const started = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...(input.options || {}) };
  const errors: AssetDiscoveryResult['errors'] = [];

  const cfg = getStorageConfig(input.storage || {});
  const useStorage = opts.uploadToStorage && !opts.sourceOnly && isStorageConfigured(cfg);

  // 1. Logo from website HTML
  let logos: DiscoveredAsset[] = [];
  if (input.websiteHtml) {
    try {
      const detection = detectLogoFromHtml(input.websiteHtml, input.websiteUrl || '');
      if (detection.url) {
        logos.push(buildLogoAsset(detection.url, input.websiteUrl || detection.url));
      }
    } catch (err) {
      errors.push({ source: 'logo', error: (err as Error).message });
    }
  }

  // 2. Brand colors from website HTML
  let brandColors: AssetDiscoveryResult['brandColors'] = {};
  if (input.websiteHtml) {
    try {
      const colors = extractColorsFromHtml(input.websiteHtml);
      brandColors = mergeIntoBrandColors({}, colors);
    } catch (err) {
      errors.push({ source: 'colors', error: (err as Error).message });
    }
  }

  // 3. Avatars
  let avatars: DiscoveredAsset[] = [];
  try {
    const maigretAvatars: string[] = [];
    for (const p of input.maigret?.platforms || []) {
      const av = p.ids_data?.avatar_url;
      if (typeof av === 'string') maigretAvatars.push(av);
    }
    avatars = extractAvatars({
      maigretAvatars,
      githubAvatarUrl: input.github?.avatar_url,
      contactAvatarUrl: input.contact?.avatarUrl,
    });
  } catch (err) {
    errors.push({ source: 'avatar', error: (err as Error).message });
  }

  // 4. Screenshot (OG image or screenshot API)
  let screenshots: DiscoveredAsset[] = [];
  if (input.websiteUrl) {
    try {
      const apiUrl = process?.env?.SCREENSHOT_API_URL;
      const apiKey = process?.env?.SCREENSHOT_API_KEY;
      const shot = await captureScreenshot({
        url: input.websiteUrl,
        html: input.websiteHtml,
        apiUrl,
        apiKey,
        timeoutMs: opts.timeoutMs,
      });
      if (shot) screenshots.push(shot);
    } catch (err) {
      errors.push({ source: 'screenshot', error: (err as Error).message });
    }
  }

  // 5. Re-upload to Supabase if storage is configured
  if (useStorage) {
    const uploaders: Array<{ list: DiscoveredAsset[]; type: string }> = [
      { list: logos, type: 'logos' },
      { list: avatars, type: 'avatars' },
      { list: screenshots, type: 'screenshots' },
    ];
    for (const { list, type } of uploaders) {
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        try {
          const filename = guessFilename(a.url, type, i);
          const path = buildContactAssetPath(input.userId, input.contactId, type, filename);
          const res = await mirrorToStorage(cfg, a.url, path, {
            timeoutMs: opts.timeoutMs,
            maxBytes: opts.maxBytes,
            userAgent: opts.userAgent,
          });
          a.url = res.url;
          a.storagePath = res.storagePath;
          a.metadata = { ...(a.metadata || {}), mirrored: true, mirroredSize: res.size };
        } catch (err) {
          // Keep the source URL on failure
          a.metadata = { ...(a.metadata || {}), mirrorError: (err as Error).message };
        }
      }
    }
  }

  return {
    logos,
    avatars,
    screenshots,
    icons: [],
    productImages: [],
    brandColors,
    errors,
    durationMs: Date.now() - started,
  };
}

/**
 * Convert an AssetDiscoveryResult into the `assets` map shape that
 * ContactProfile uses, deduplicating by URL.
 */
export function mergeIntoProfileAssets(
  profile: { assets?: { avatar?: string[]; logos?: string[]; productImages?: string[]; icons?: string[]; videos?: string[] } } | undefined,
  result: AssetDiscoveryResult,
): NonNullable<typeof profile.assets> {
  const out = {
    avatar: dedupe([...(profile?.assets?.avatar || []), ...result.avatars.map((a) => a.url)]),
    logos: dedupe([...(profile?.assets?.logos || []), ...result.logos.map((a) => a.url)]),
    productImages: dedupe([...(profile?.assets?.productImages || []), ...result.productImages.map((a) => a.url)]),
    icons: dedupe([...(profile?.assets?.icons || []), ...result.icons.map((a) => a.url)]),
    videos: dedupe([...(profile?.assets?.videos || [])]),
  };
  return out;
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

function guessFilename(url: string, type: string, idx: number): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').pop();
    if (last && /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(last)) return last;
  } catch {}
  const ext = guessExtFromUrl(url);
  return `${type}-${idx}${ext}`;
}

function guessExtFromUrl(url: string): string {
  const m = url.match(/\.(png|jpe?g|webp|gif|svg|ico)(\?|$)/i);
  return m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.png';
}
