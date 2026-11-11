/**
 * Auto-placement engine for discovered business assets.
 *
 * Automatically assigns high-confidence recommended assets to the correct
 * content sections, respecting centralized limits and exclusions.
 */

import type { DiscoveredAsset, DiscoveredAssetCategory, AssignedSection } from '../shared/personalization/types'

export interface AutoPlacementConfig {
  personLimit: number
  logoLimit: number
  productsLimit: number
  brandLimit: number
  minConfidence: number
}

export const DEFAULT_AUTO_PLACEMENT_CONFIG: AutoPlacementConfig = {
  personLimit: 4,
  logoLimit: 1,
  productsLimit: 6,
  brandLimit: 5,
  minConfidence: 70,
}

const CATEGORY_TO_SECTION: Record<DiscoveredAssetCategory, AssignedSection> = {
  person: 'person',
  logo: 'logo',
  product: 'products',
  service: 'products',
  completed_work: 'products',
  storefront: 'brand',
  office: 'brand',
  branded_vehicle: 'brand',
  team: 'brand',
  brand: 'brand',
  irrelevant: null,
}

const NEVER_AUTO_ASSIGN_SECTIONS: AssignedSection[] = ['firstFrame', 'lastFrame', 'ctaGraphic']

export function autoPlaceAssets(
  assets: DiscoveredAsset[],
  config: AutoPlacementConfig = DEFAULT_AUTO_PLACEMENT_CONFIG,
): DiscoveredAsset[] {
  const sectionCounts: Record<string, number> = {
    person: 0,
    logo: 0,
    products: 0,
    brand: 0,
  }

  return assets.map((asset) => {
    if (asset.rejected || !asset.recommended) {
      return { ...asset, assignedSection: null, autoAssigned: false }
    }

    if (asset.confidence == null || asset.confidence < config.minConfidence) {
      return { ...asset, assignedSection: null, autoAssigned: false }
    }

    const section = CATEGORY_TO_SECTION[asset.category]
    if (!section || NEVER_AUTO_ASSIGN_SECTIONS.includes(section)) {
      return { ...asset, assignedSection: null, autoAssigned: false }
    }

    const limit = section === 'person' ? config.personLimit :
                  section === 'logo' ? config.logoLimit :
                  section === 'products' ? config.productsLimit :
                  section === 'brand' ? config.brandLimit : 0

    if (limit > 0 && sectionCounts[section] < limit) {
      sectionCounts[section]++
      return { ...asset, assignedSection: section, autoAssigned: true }
    }

    return { ...asset, assignedSection: null, autoAssigned: false }
  })
}
