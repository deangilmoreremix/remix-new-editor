import { describe, expect, it } from 'vitest'
import {
  ASSET_RECIPES,
  IMAGE_EDIT_OPERATIONS,
  getAssetRecipe,
  getSourceAssetRecipe,
  getOperationsForAsset,
  resolveEditorAssetKind,
  resolveEditorRecipeKind,
} from '../image-editor/imageEditRegistry'
import type { DiscoveredAssetCategory } from '../types'

describe('SmartVideo GO image edit registry', () => {
  it('covers every useful discovery category with a dedicated recipe', () => {
    const categories: DiscoveredAssetCategory[] = [
      'person',
      'logo',
      'product',
      'service',
      'completed_work',
      'storefront',
      'office',
      'branded_vehicle',
      'team',
      'brand',
    ]

    for (const category of categories) {
      const recipe = getAssetRecipe(category)
      expect(recipe.kind).toBe(category)
      expect(recipe.recommended.length).toBeGreaterThan(0)
      expect(recipe.makeVideoReadySteps.length).toBeGreaterThan(0)
      expect(recipe.preserve.length).toBeGreaterThan(0)
    }
  })

  it('covers manual personalization destination roles', () => {
    expect(resolveEditorAssetKind(undefined, 'first_frame')).toBe('first_frame')
    expect(resolveEditorAssetKind(undefined, 'last_frame')).toBe('last_frame')
    expect(resolveEditorAssetKind(undefined, 'cta_graphic')).toBe('cta_graphic')
    expect(resolveEditorAssetKind(undefined, 'background_reference')).toBe('background_reference')
    expect(resolveEditorAssetKind(undefined, 'saved_reference')).toBe('saved_reference')
  })

  it('keeps source semantics while explicit video destinations drive the recipe', () => {
    expect(resolveEditorAssetKind('storefront', 'first_frame')).toBe('storefront')
    expect(resolveEditorRecipeKind('storefront', 'first_frame')).toBe('first_frame')
    expect(getSourceAssetRecipe('storefront', 'first_frame').kind).toBe('storefront')
    expect(getAssetRecipe('storefront', 'first_frame').kind).toBe('first_frame')

    expect(resolveEditorAssetKind('product', 'cta_graphic')).toBe('product')
    expect(resolveEditorRecipeKind('product', 'cta_graphic')).toBe('cta_graphic')
    expect(getSourceAssetRecipe('product', 'cta_graphic').preserve).toContain('packaging')
    expect(getAssetRecipe('product', 'cta_graphic').makeVideoReadySteps).toContain('cta_prep')
  })

  it('has recipes for all editor asset kinds', () => {
    for (const recipe of Object.values(ASSET_RECIPES)) {
      expect(recipe.primaryAction).toBe('video_ready')
      expect(recipe.outputRole.length).toBeGreaterThan(0)
    }
  })

  it('exposes the full AI editing catalog', () => {
    const operations = Object.values(IMAGE_EDIT_OPERATIONS)
    expect(operations.length).toBeGreaterThanOrEqual(60)
    expect(IMAGE_EDIT_OPERATIONS.remove_background.transparency).toBe(true)
    expect(IMAGE_EDIT_OPERATIONS.presenter_cutout.precision).toBe(true)
    expect(IMAGE_EDIT_OPERATIONS.product_isolate.transparency).toBe(true)
    expect(IMAGE_EDIT_OPERATIONS.replace_text.precision).toBe(true)
    expect(IMAGE_EDIT_OPERATIONS.storefront_enhance.applicableTo).toContain('storefront')
    expect(getOperationsForAsset('logo').some((operation) => operation.id === 'logo_cleanup')).toBe(true)
    expect(getOperationsForAsset('person').some((operation) => operation.id === 'change_clothing')).toBe(true)
  })
})
