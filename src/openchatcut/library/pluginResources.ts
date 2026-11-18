// SPDX-License-Identifier: AGPL-3.0-or-later — OpenChatCut (src/library/pluginResources.ts), vendored.
// [remix] ResourceItem is type-only (their ResourceBrowser UI is not vendored); declared here with the fields used.
import { useEffect, useState } from 'react';
import { listPacks, subscribePlugins, type InstalledPack } from '../plugins/store';
import { pluginAssetId } from '../plugins/types';
export interface ResourceItem { id: string; name: string; badge?: string; thumb?: string; data?: Record<string, unknown> }

/** Real-time list of installed extensions (installation/uninstallation automatically refreshes) */
export function usePluginPacks(): InstalledPack[] {
  const [packs, setPacks] = useState<InstalledPack[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => { void listPacks().then((next) => { if (alive) setPacks(next); }); };
    load();
    const unsubscribe = subscribePlugins(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return packs;
}

/** Certain types of extended entries → Resource card list (for transition/special effects/LUT/zoom tab merging) */
export function pluginResourceItems(
  packs: InstalledPack[],
  type: 'fx' | 'lut' | 'transition' | 'zoom',
): ResourceItem[] {
  const out: ResourceItem[] = [];
  for (const pack of packs) {
    if (!pack.enabled) continue;
    for (const item of pack.items) {
      if (item.type !== type) continue;
      out.push({
        id: pluginAssetId(pack.id, item.id),
        name: item.name,
        badge: '扩展',
        ...(item.thumb ? { thumb: item.thumb } : {}),
        ...(item.type === 'zoom'
          ? { data: {
              envelope: item.envelope,
              shape: item.shape,
              magnification: item.magnification ?? 1.5,
              focalPointX: item.focalPointX,
              focalPointY: item.focalPointY,
              easeInFrames: item.easeInFrames,
              easeOutFrames: item.easeOutFrames,
              label: item.name,
            } }
          : {}),
      });
    }
  }
  return out;
}

