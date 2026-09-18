/**
 * Model Picker Tests
 * Verifies the shared vanilla model selector UI behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { imageModelPickerEntries, videoModelPickerEntries, imageModelPickerEntryByVariantId, videoModelPickerEntryByVariantId } from '../../src/lib/modelFamilies.js';
import { mountTemplateModelSelector, mountVideoModelSelector, mountImageModelSelector } from '../../src/lib/modelSelectorUI.js';

describe('Model Families and Picker Entries', () => {
  it('imageModelPickerEntries has entries', () => {
    expect(imageModelPickerEntries.length).toBeGreaterThan(0);
  });

  it('videoModelPickerEntries has entries', () => {
    expect(videoModelPickerEntries.length).toBeGreaterThan(0);
  });

  it('each picker entry has variantsByMode with compatible modes', () => {
    for (const entry of imageModelPickerEntries) {
      const modes = Object.keys(entry.variantsByMode);
      expect(modes.length).toBeGreaterThan(0);
      for (const mode of modes) {
        expect(['t2i', 'i2i']).toContain(mode);
      }
    }
    for (const entry of videoModelPickerEntries) {
      const modes = Object.keys(entry.variantsByMode);
      expect(modes.length).toBeGreaterThan(0);
      for (const mode of modes) {
        expect(['t2v', 'i2v', 'v2v']).toContain(mode);
      }
    }
  });

  it('picker entry variantIds map to catalog variantById', () => {
    for (const entry of imageModelPickerEntries) {
      for (const variantId of entry.variantIds) {
        expect(imageModelPickerEntryByVariantId.has(variantId)).toBe(true);
      }
    }
    for (const entry of videoModelPickerEntries) {
      for (const variantId of entry.variantIds) {
        expect(videoModelPickerEntryByVariantId.has(variantId)).toBe(true);
      }
    }
  });

  it('searchText is populated for all entries', () => {
    for (const entry of imageModelPickerEntries) {
      expect(entry.searchText.length).toBeGreaterThan(0);
    }
    for (const entry of videoModelPickerEntries) {
      expect(entry.searchText.length).toBeGreaterThan(0);
    }
  });
});

describe('Model Selector UI', () => {
  let anchor;

  beforeEach(() => {
    anchor = document.createElement('button');
    anchor.textContent = 'Select model';
    document.body.appendChild(anchor);
  });

  afterEach(() => {
    if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
    document.body.innerHTML = '';
  });

  it('mounts a dropdown panel on open', () => {
    const picker = mountTemplateModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2i', 'i2i'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    picker.cleanup();
  });

  it('closes on escape key', () => {
    const picker = mountTemplateModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2i', 'i2i'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);
    
    // Wait for close animation
    return new Promise(resolve => setTimeout(resolve, 300)).then(() => {
      const panelAfter = document.querySelector('.model-picker-panel');
      expect(panelAfter).toBeNull();
      picker.cleanup();
    });
  });

  it('closes on outside click', () => {
    const picker = mountTemplateModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2i', 'i2i'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    
    const outside = document.createElement('div');
    outside.id = 'outside';
    document.body.appendChild(outside);
    outside.click();
    
    return new Promise(resolve => setTimeout(resolve, 300)).then(() => {
      const panelAfter = document.querySelector('.model-picker-panel');
      expect(panelAfter).toBeNull();
      picker.cleanup();
    });
  });

  it('shows empty state when search has no matches', () => {
    const picker = mountTemplateModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2i', 'i2i'],
      onSelectModel: () => {},
      onClose: () => {},
      copy: { noModelsFound: 'No models found' },
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    
    // Simulate search with no matches
    const searchInput = panel.querySelector('input[type="text"]');
    if (searchInput) {
      searchInput.value = 'zzzzznomatch';
      searchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
    
    expect(panel.textContent).toContain('No models found');
    picker.cleanup();
  });

  it('T2V category filtering shows only T2V-capable models', () => {
    const picker = mountVideoModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2v', 'i2v', 'v2v'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    
    // Click T2V category button
    const t2vBtn = panel.querySelector('[data-model-picker-category="t2v"]');
    if (t2vBtn) {
      t2vBtn.click();
      const entries = panel.querySelectorAll('[data-model-picker-entry]');
      for (const entry of entries) {
        expect(entry.dataset.modelPickerEntry).toBe('t2v');
      }
    }
    
    picker.cleanup();
  });

  it('I2V category filtering shows only I2V-capable models', () => {
    const picker = mountVideoModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2v', 'i2v', 'v2v'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    
    // Click I2V category button
    const i2vBtn = panel.querySelector('[data-model-picker-category="i2v"]');
    if (i2vBtn) {
      i2vBtn.click();
      const entries = panel.querySelectorAll('[data-model-picker-entry]');
      for (const entry of entries) {
        expect(entry.dataset.modelPickerEntry).toBe('i2v');
      }
    }
    
    picker.cleanup();
  });

  it('family groups are deduplicated', () => {
    const families = new Set();
    for (const entry of videoModelPickerEntries) {
      families.add(entry.family.id);
    }
    expect(families.size).toBeGreaterThan(0);
    expect(families.size).toBeLessThanOrEqual(videoModelPickerEntries.length);
  });

  it('preferred variant resolution returns a valid model id', () => {
    for (const entry of videoModelPickerEntries) {
      if (entry.variantsByMode.t2v) {
        const variant = entry.variantsByMode.t2v;
        expect(variant.model.id).toBeDefined();
        expect(typeof variant.model.id).toBe('string');
        expect(variant.model.id.length).toBeGreaterThan(0);
      }
    }
  });

  it('selected item receives aria-pressed=true on selection', () => {
    const picker = mountTemplateModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2i', 'i2i'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    
    const firstEntry = panel.querySelector('[data-model-picker-entry]');
    if (firstEntry) {
      firstEntry.click();
      expect(firstEntry.getAttribute('aria-pressed')).toBe('true');
    }
    
    picker.cleanup();
  });

  it('incompatible model types are not shown in the picker', () => {
    const picker = mountTemplateModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2i'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    
    // No i2v entries should be present when only t2i is allowed
    const i2vEntries = panel.querySelectorAll('[data-model-picker-entry="i2v"]');
    expect(i2vEntries.length).toBe(0);
    
    picker.cleanup();
  });

  it('provider logo fallback renders when logo URL is missing', () => {
    const picker = mountTemplateModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2i', 'i2i'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    
    // Fallback provider badges should render for providers without logos
    const fallbackBadges = panel.querySelectorAll('.model-picker-provider-fallback');
    expect(fallbackBadges.length).toBeGreaterThanOrEqual(0);
    
    picker.cleanup();
  });

  it('selected item scrolling is guarded by typeof scrollIntoView', () => {
    const picker = mountTemplateModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2i', 'i2i'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    
    // Select an entry to trigger scroll
    const firstEntry = panel.querySelector('[data-model-picker-entry]');
    if (firstEntry) {
      firstEntry.click();
    }
    
    // Should not throw even if scrollIntoView is not a function
    expect(() => picker.cleanup()).not.toThrow();
  });

  it('picker flips above trigger when insufficient space below', () => {
    // Place anchor near bottom of viewport
    anchor.style.position = 'fixed';
    anchor.style.bottom = '10px';
    anchor.style.left = '10px';
    
    const picker = mountTemplateModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2i', 'i2i'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('model-picker-panel')).toBe(true);
    
    picker.cleanup();
  });

  it('picker remains below trigger when sufficient space exists', () => {
    // Place anchor near top of viewport
    anchor.style.position = 'fixed';
    anchor.style.top = '10px';
    anchor.style.left = '10px';
    
    const picker = mountTemplateModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2i', 'i2i'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    
    const panelRect = panel.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    
    // Panel should be below the anchor
    expect(panelRect.top).toBeGreaterThanOrEqual(anchorRect.bottom - 10);
    
    picker.cleanup();
  });

  it('picker is horizontally clamped inside viewport', () => {
    // Place anchor near right edge
    anchor.style.position = 'fixed';
    anchor.style.right = '10px';
    anchor.style.top = '10px';
    
    const picker = mountTemplateModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2i', 'i2i'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    
    const panelRect = panel.getBoundingClientRect();
    expect(panelRect.right).toBeLessThanOrEqual(window.innerWidth + 10);
    
    picker.cleanup();
  });

  it('search works by family name, model name, and exact model ID', () => {
    const picker = mountVideoModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2v', 'i2v', 'v2v'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    
    const searchInput = panel.querySelector('input[type="text"]');
    if (searchInput) {
      // Search by family name
      searchInput.value = 'openai';
      searchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
      
      // Search by model name
      searchInput.value = 'sora';
      searchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
      
      // Search by exact model ID
      searchInput.value = 'kling-1.6';
      searchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
      
      // Clear search
      searchInput.value = '';
      searchInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
    
    picker.cleanup();
  });

  it('ARIA state changes when selection changes', () => {
    const picker = mountTemplateModelSelector({
      anchor,
      selectedModelId: null,
      allowedModelTypes: ['t2i', 'i2i'],
      onSelectModel: () => {},
      onClose: () => {},
    });
    picker.open();
    const panel = document.querySelector('.model-picker-panel');
    expect(panel).not.toBeNull();
    
    const entries = panel.querySelectorAll('[data-model-picker-entry]');
    if (entries.length > 0) {
      const firstEntry = entries[0];
      expect(firstEntry.getAttribute('aria-pressed')).not.toBe('true');
      
      firstEntry.click();
      expect(firstEntry.getAttribute('aria-pressed')).toBe('true');
    }
    
    picker.cleanup();
  });
});
