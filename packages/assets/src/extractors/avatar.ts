// packages/assets/src/extractors/avatar.ts
//
// Pull avatar URLs out of the discovery results we've already collected
// (Maigret, GitHub, website). We don't fetch anything here — we just
// pick the best URL from the inputs the orchestrator passes in.

import type { DiscoveredAsset } from '../types.ts';

export interface AvatarInputs {
  /** From Maigret scan result: `ids_data.avatar_url` */
  maigretAvatars?: string[];
  /** From GitHub API: `avatar_url` */
  githubAvatarUrl?: string;
  /** From contact record (user-supplied or pre-existing) */
  contactAvatarUrl?: string;
}

export function extractAvatars(inputs: AvatarInputs): DiscoveredAsset[] {
  const out: DiscoveredAsset[] = [];
  const seen = new Set<string>();

  const push = (url: string | undefined, source: DiscoveredAsset['source']['source']) => {
    if (!url) return;
    if (seen.has(url)) return;
    seen.add(url);
    out.push({
      assetType: 'headshot',
      url,
      source: {
        source: source as AvatarInputs['maigretAvatars'] extends never ? never : 'website',
        sourceUrl: url,
        discoveredAt: new Date().toISOString(),
      },
    });
  };

  for (const url of inputs.maigretAvatars || []) push(url, 'maigret');
  push(inputs.githubAvatarUrl, 'github');
  push(inputs.contactAvatarUrl, 'manual');

  return out;
}
