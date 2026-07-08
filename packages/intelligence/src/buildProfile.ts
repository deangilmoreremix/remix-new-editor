// packages/intelligence/src/buildProfile.ts
import type { ContactProfile, EnrichmentResult, MaigretScanResult, WebsiteInfo } from './types.ts';
import { scanWithMaigret, isMaigretConfigured } from '../discovery/src/providers/maigret.ts';
import { scanGitHub, extractUsernameFromGitHubUrl } from '../discovery/src/providers/github.ts';
import { crawlWebsite, extractDomainFromUrl } from '../discovery/src/providers/website.ts';
import { extractIntelligence, extractCompanyInfo, extractBrandFromWebsite, buildVariables } from '../enrichment/src/extractIntelligence.ts';
import {
  getProfile,
  updateProfile,
  addDiscovery,
  getAssets,
  addAsset,
} from '../contacts/src/ContactStore.ts';
import {
  discoverAssets,
  mergeIntoProfileAssets,
  type DiscoverAssetsInput,
} from '../../assets/src/index.ts';

export interface BuildProfileOptions {
  contactId: string;
  sources?: Array<'maigret' | 'github' | 'website'>;
  onProgress?: (stage: string, progress: number) => void;
}

export interface BuildProfileResult {
  profile: ContactProfile;
  stages: Array<{ stage: string; durationMs: number; success: boolean; error?: string }>;
}

export async function buildProfile(options: BuildProfileOptions): Promise<BuildProfileResult> {
  const { contactId, sources = ['maigret', 'github', 'website'], onProgress } = options;
  const stages: BuildProfileResult['stages'] = [];
  const profile = getProfile(contactId);
  if (!profile) {
    throw new Error(`Contact profile not found: ${contactId}`);
  }

  const startTime = Date.now();

  // Stage 1: Discovery
  const maigretResult = await runMaigretStage(profile, sources, onProgress);
  stages.push(maigretResult.stage);

  const githubResult = await runGitHubStage(profile, maigretResult.data, sources, onProgress);
  stages.push(githubResult.stage);

  const websiteResult = await runWebsiteStage(profile, githubResult.data, sources, onProgress);
  stages.push(websiteResult.stage);

  // Stage 2: Enrichment
  const enrichmentResult = await runEnrichmentStage(profile, websiteResult.data, onProgress);
  stages.push(enrichmentResult.stage);

  // Stage 3: Assets
  const assetsResult = await runAssetsStage(profile, enrichmentResult.data, onProgress);
  stages.push(assetsResult.stage);

  // Stage 4: Variables
  const variables = buildVariables(profile);
  profile.variables = variables;
  stages.push({
    stage: 'variables',
    durationMs: 0,
    success: true,
  });

  profile.updatedAt = new Date().toISODate();

  return {
    profile: updateProfile(contactId, profile) || profile,
    stages,
  };
}

async function runMaigretStage(
  profile: ContactProfile,
  sources: string[],
  onProgress?: (stage: string, progress: number) => void
): Promise<{ stage: any; data?: MaigretScanResult }> {
  const stageName = 'maigret';
  const start = Date.now();

  if (!sources.includes(stageName) || !isMaigretConfigured()) {
    return {
      stage: { stage: stageName, durationMs: Date.now() - start, success: false, error: 'skipped' },
    };
  }

  try {
    onProgress?.(stageName, 10);
    const username = profile.contact.firstName
      ? `${profile.contact.firstName}${profile.contact.lastName ? ` ${profile.contact.lastName}` : ''}`
      : profile.contact.name;

    const result = await scanWithMaigret(username, {
      top: 500,
      retries: 1,
      isParsingEnabled: true,
    });

    addDiscovery(profile.id, 'maigret', 'success', result, undefined, Date.now() - start);
    profile.history.discoveries.push({
      source: 'maigret',
      timestamp: new Date().toISOString(),
      success: true,
    });

    // Extract social URLs from Maigret results
    for (const p of result.platforms) {
      const platform = p.platform.toLowerCase();
      if (platform === 'github') {
        profile.social.github = p.url;
      } else if (platform === 'linkedin') {
        profile.social.linkedin = p.url;
      } else if (platform === 'twitter' || platform === 'x') {
        profile.social.twitter = p.url;
      } else if (platform === 'youtube') {
        profile.social.youtube = p.url;
      } else if (platform === 'instagram') {
        profile.social.instagram = p.url;
      } else if (platform === 'mastodon') {
        profile.social.mastodon = p.url;
      }

      // Extract avatar if available
      if (p.ids_data?.avatar_url && !profile.assets.avatar?.length) {
        profile.assets.avatar = [p.ids_data.avatar_url];
      }
    }

    onProgress?.(stageName, 40);
    return {
      stage: { stage: stageName, durationMs: Date.now() - start, success: true },
      data: result,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    addDiscovery(profile.id, 'maigret', 'failed', undefined, error, Date.now() - start);
    profile.history.discoveries.push({
      source: 'maigret',
      timestamp: new Date().toISOString(),
      success: false,
    });
    return {
      stage: { stage: stageName, durationMs: Date.now() - start, success: false, error },
    };
  }
}

async function runGitHubStage(
  profile: ContactProfile,
  maigretData?: MaigretScanResult,
  sources: string[] = [],
  onProgress?: (stage: string, progress: number) => void
): Promise<{ stage: any; data?: any }> {
  const stageName = 'github';
  const start = Date.now();

  if (!sources.includes(stageName)) {
    return { stage: { stage: stageName, durationMs: Date.now() - start, success: false, error: 'skipped' } };
  }

  try {
    let githubUsername: string | null = null;

    // Try to find GitHub from Maigret results first
    if (maigretData?.platforms) {
      const ghPlatform = maigretData.platforms.find((p) => p.platform.toLowerCase() === 'github');
      if (ghPlatform?.url) {
        githubUsername = extractUsernameFromGitHubUrl(ghPlatform.url);
      }
    }

    // Fallback: try profile.contact.name as GitHub username
    if (!githubUsername && profile.contact.firstName) {
      githubUsername = `${profile.contact.firstName}${profile.contact.lastName || ''}`.replace(/\s+/g, '');
    }

    if (!githubUsername) {
      return {
        stage: { stage: stageName, durationMs: Date.now() - start, success: false, error: 'no username' },
      };
    }

    onProgress?.(stageName, 50);
    const result = await scanGitHub(githubUsername);

    addDiscovery(profile.id, 'github', result.platforms.length > 0 ? 'success' : 'failed', result, undefined, Date.now() - start);
    profile.history.discoveries.push({
      source: 'github',
      timestamp: new Date().toISOString(),
      success: result.platforms.length > 0,
    });

    if (result.platforms.length > 0) {
      const gh = result.platforms[0];
      profile.social.github = gh.url;

      if (!profile.contact.avatarUrl && gh.ids_data?.avatar_url) {
        profile.assets.avatar = [gh.ids_data.avatar_url];
        profile.contact.avatarUrl = gh.ids_data.avatar_url;
      }

      if (gh.ids_data?.company && !profile.contact.company) {
        profile.contact.company = gh.ids_data.company;
      }

      if (gh.ids_data?.location && !profile.contact.location) {
        profile.contact.location = gh.ids_data.location;
      }

      if (gh.ids_data?.bio && !profile.intelligence.summary) {
        profile.intelligence.summary = gh.ids_data.bio;
      }
    }

    onProgress?.(stageName, 60);
    return { stage: { stage: stageName, durationMs: Date.now() - start, success: true }, data: result };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    addDiscovery(profile.id, 'github', 'failed', undefined, error, Date.now() - start);
    return { stage: { stage: stageName, durationMs: Date.now() - start, success: false, error } };
  }
}

async function runWebsiteStage(
  profile: ContactProfile,
  _githubData: any,
  sources: string[] = [],
  onProgress?: (stage: string, progress: number) => void
): Promise<{ stage: any; data?: WebsiteInfo }> {
  const stageName = 'website';
  const start = Date.now();

  if (!sources.includes(stageName)) {
    return { stage: { stage: stageName, durationMs: Date.now() - start, success: false, error: 'skipped' } };
  }

  try {
    let websiteUrl = profile.social.website;

    // Try to derive from company name
    if (!websiteUrl && profile.contact.company) {
      const domain = `${profile.contact.company.toLowerCase().replace(/\s+/g, '')}.com`;
      websiteUrl = `https://${domain}`;
    }

    if (!websiteUrl) {
      return {
        stage: { stage: stageName, durationMs: Date.now() - start, success: false, error: 'no url' },
      };
    }

    onProgress?.(stageName, 70);
    const result = await crawlWebsite(websiteUrl);

    addDiscovery(profile.id, 'website', result.title ? 'success' : 'failed', result, undefined, Date.now() - start);
    profile.history.discoveries.push({
      source: 'website',
      timestamp: new Date().toISOString(),
      success: Boolean(result.title),
    });

    if (result.url) profile.website.url = result.url;
    if (result.title) profile.website.title = result.title;
    if (result.description) profile.website.description = result.description;
    if (result.screenshotUrl) profile.website.screenshotUrl = result.screenshotUrl;
    if (result.faviconUrl) profile.website.faviconUrl = result.faviconUrl;
    if (result.pages?.length) profile.website.pages = result.pages;

    // Extract domain
    if (!profile.company.domain) {
      profile.company.domain = extractDomainFromUrl(websiteUrl);
    }

    onProgress?.(stageName, 80);
    return { stage: { stage: stageName, durationMs: Date.now() - start, success: true }, data: result };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    addDiscovery(profile.id, 'website', 'failed', undefined, error, Date.now() - start);
    return { stage: { stage: stageName, durationMs: Date.now() - start, success: false, error } };
  }
}

async function runEnrichmentStage(
  profile: ContactProfile,
  websiteData?: WebsiteInfo,
  onProgress?: (stage: string, progress: number) => void
): Promise<{ stage: any; data?: EnrichmentResult }> {
  const stageName = 'enrichment';
  const start = Date.now();

  try {
    onProgress?.(stageName, 85);

    const enrichment = await extractIntelligence({
      bio: profile.intelligence.summary,
      company: profile.contact.company,
      websiteText: websiteData?.pages?.[0]?.text,
      githubBio: profile.intelligence.summary,
    });

    if (enrichment.company) {
      profile.company = { ...profile.company, ...enrichment.company };
    }

    if (enrichment.intelligence) {
      profile.intelligence = { ...profile.intelligence, ...enrichment.intelligence };
    }

    if (enrichment.brand) {
      profile.brand = { ...profile.brand, ...enrichment.brand };
    }

    onProgress?.(stageName, 95);
    return { stage: { stage: stageName, durationMs: Date.now() - start, success: true }, data: enrichment };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { stage: { stage: stageName, durationMs: Date.now() - start, success: false, error } };
  }
}

async function runAssetsStage(
  profile: ContactProfile,
  _enrichmentData?: EnrichmentResult,
  onProgress?: (stage: string, progress: number) => void
): Promise<{ stage: any }> {
  const stageName = 'assets';
  const start = Date.now();

  try {
    onProgress?.(stageName, 98);

    // Run the dedicated asset discovery orchestrator. This:
    //   1. Re-detects the best logo URL from the website HTML (header img,
    //      og:image, apple-touch-icon, JSON-LD, etc.)
    //   2. Re-extracts brand colors from inline CSS / theme-color / mask-icon
    //   3. Picks the best avatar from Maigret + GitHub + contact record
    //   4. Captures a website screenshot (OG image fallback or API)
    //   5. Re-uploads all of the above to Supabase storage when configured
    //      so the URLs are stable.
    const input: DiscoverAssetsInput = {
      contactId: profile.id,
      userId: profile.contact.userId || 'local-user',
      websiteUrl: profile.website.url,
      websiteHtml: profile.website.pages?.[0]?.text
        ? `<html><head>${profile.website.pages[0].title ? `<title>${profile.website.pages[0].title}</title>` : ''}</head><body>${profile.website.pages[0].text}</body></html>`
        : undefined,
      contact: { avatarUrl: profile.contact.avatarUrl },
      options: { uploadToStorage: true, timeoutMs: 10000 },
    };

    const result = await discoverAssets(input);
    addDiscovery(profile.id, 'assets', result.errors.length ? 'failed' : 'success', result, result.errors.length ? result.errors[0].error : undefined, Date.now() - start);

    // Merge discovered assets into the profile's asset map
    profile.assets = mergeIntoProfileAssets(profile.assets, result);

    // Merge discovered brand colors into the profile (don't overwrite existing)
    if (result.brandColors.primary || result.brandColors.secondary || result.brandColors.accent) {
      profile.brand = profile.brand || {};
      profile.brand.colors = {
        ...(profile.brand.colors || {}),
        ...(result.brandColors.primary ? { primary: result.brandColors.primary } : {}),
        ...(result.brandColors.secondary ? { secondary: result.brandColors.secondary } : {}),
        ...(result.brandColors.accent ? { accent: result.brandColors.accent } : {}),
      };
    }

    // Persist each discovered asset to the contact_assets table
    const allDiscovered = [
      ...result.logos,
      ...result.avatars,
      ...result.screenshots,
      ...result.icons,
      ...result.productImages,
    ];
    for (const a of allDiscovered) {
      addAsset(profile.id, {
        assetType: a.assetType,
        url: a.url,
        storagePath: a.storagePath,
        metadata: { ...(a.metadata || {}), discoveredFrom: a.source.source },
      });
    }

    return { stage: { stage: stageName, durationMs: Date.now() - start, success: result.errors.length === 0, error: result.errors.length ? `${result.errors.length} extractor(s) failed` : undefined } };
  } catch (err) {
    return { stage: { stage: stageName, durationMs: Date.now() - start, success: false, error: String(err) } };
  }
}
