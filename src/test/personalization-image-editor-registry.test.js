import { describe, expect, it } from 'vitest';
import {
  ASSET_RECIPES,
  IMAGE_EDIT_OPERATIONS,
  getAssetRecipe,
  getOperation,
  getOperationsForAsset,
  resolveEditorAssetKind,
  resolveEditorRecipeKind,
} from '../lib/personalization/imageEditRegistry.js';
import {
  buildPersonalizationEditPrompt,
  resolvePersonalizationEditControls,
} from '../lib/personalization/imageEditorService.js';

describe('personalization image edit registry', () => {
  it('ports all 68 OpenHiggs operations', () => {
    expect(Object.keys(IMAGE_EDIT_OPERATIONS)).toHaveLength(68);
  });

  it('ports all 16 asset recipes', () => {
    expect(Object.keys(ASSET_RECIPES)).toHaveLength(16);
  });

  it('keeps source category semantics for protection rules', () => {
    expect(resolveEditorAssetKind('storefront', 'first_frame')).toBe('storefront');
  });

  it('lets explicit destination roles select the Video Ready recipe', () => {
    expect(resolveEditorRecipeKind('storefront', 'first_frame')).toBe('first_frame');
    expect(getAssetRecipe('storefront', 'first_frame').outputRole).toBe('Opening Frame');
  });

  it('limits person-specific operations to people assets', () => {
    const personOps = getOperationsForAsset('person').map((x) => x.id);
    const logoOps = getOperationsForAsset('logo').map((x) => x.id);
    expect(personOps).toContain('presenter_cutout');
    expect(logoOps).not.toContain('presenter_cutout');
  });

  it('marks destructive creative edits explicitly', () => {
    expect(getOperation('change_environment').destructiveCreative).toBe(true);
    expect(getOperation('enhance').destructiveCreative).not.toBe(true);
  });
});

describe('personalization image editor service helpers', () => {
  it('injects operation, role and preservation context into the prompt', () => {
    const prompt = buildPersonalizationEditPrompt({
      operationId: 'product_isolate',
      category: 'product',
      role: 'product_reference',
      businessContext: {
        businessName: 'Acme',
        productService: 'Roofing',
        preserve: ['serial number'],
      },
      visionAnalysis: {
        targetRole: 'Product Overlay',
        preserve: ['package text'],
      },
    });

    expect(prompt).toContain('Isolate the product');
    expect(prompt).toContain('Business: Acme');
    expect(prompt).toContain('Product/service: Roofing');
    expect(prompt).toContain('Target video role: Product Overlay');
    expect(prompt).toContain('package text');
    expect(prompt).toContain('serial number');
  });

  it('defaults sensitive transparent assets to high fidelity PNG', () => {
    const controls = resolvePersonalizationEditControls({
      operationId: 'logo_transparent',
      category: 'logo',
      role: 'logo',
    });
    expect(controls.inputFidelity).toBe('high');
    expect(controls.outputFormat).toBe('png');
    expect(controls.background).toBe('transparent');
  });

  it('allows explicit output controls to override defaults', () => {
    const controls = resolvePersonalizationEditControls({
      operationId: 'enhance',
      category: 'general',
      quality: 'medium',
      outputFormat: 'jpeg',
      outputCompression: 72,
      background: 'opaque',
      inputFidelity: 'high',
    });
    expect(controls.quality).toBe('medium');
    expect(controls.outputFormat).toBe('jpeg');
    expect(controls.outputCompression).toBe(72);
    expect(controls.background).toBe('opaque');
    expect(controls.inputFidelity).toBe('high');
  });
});
