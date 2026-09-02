import { describe, it, expect } from 'vitest';
import { buildIndividualPrompts, buildPanelLabels, ELEMENT_TYPES, createElementImage, createElement } from '../elements-helpers.js';

describe('elements-helpers', () => {
  describe('buildPanelLabels', () => {
    it('returns exactly 7 labels for each category', () => {
      for (const type of ELEMENT_TYPES) {
        const labels = buildPanelLabels(type);
        expect(labels).toHaveLength(7);
      }
    });

    it('returns CineGen-exact character labels', () => {
      expect(buildPanelLabels('character')).toEqual([
        'Front',
        'Left Profile',
        'Right Profile',
        'Back',
        'Front Portrait',
        'Left Portrait',
        'Right Portrait',
      ]);
    });

    it('returns CineGen-exact location labels', () => {
      expect(buildPanelLabels('location')).toEqual([
        'Front/Entrance',
        'Left Angle',
        'Right Angle',
        'Aerial',
        'Key Detail',
        'Textures',
        'Atmosphere',
      ]);
    });

    it('returns CineGen-exact prop labels', () => {
      expect(buildPanelLabels('prop')).toEqual([
        'Front',
        'Left Side',
        'Right Side',
        'Back',
        'Top-Down',
        'Detail',
        'Texture',
      ]);
    });

    it('returns CineGen-exact vehicle labels', () => {
      expect(buildPanelLabels('vehicle')).toEqual([
        'Front',
        'Left Profile',
        'Right Profile',
        'Rear',
        'Hero Angle',
        'Interior',
        'Key Detail',
      ]);
    });
  });

  describe('buildIndividualPrompts', () => {
    it('returns exactly 7 prompts for each category', () => {
      for (const type of ELEMENT_TYPES) {
        const prompts = buildIndividualPrompts(type, 'test description');
        expect(prompts).toHaveLength(7);
      }
    });

    it('includes the description in each prompt', () => {
      const desc = 'a cyberpunk hacker';
      const prompts = buildIndividualPrompts('character', desc);
      for (const prompt of prompts) {
        expect(prompt).toContain(desc);
      }
    });

    it('includes common suffix in each prompt', () => {
      const prompts = buildIndividualPrompts('character', 'test');
      for (const prompt of prompts) {
        expect(prompt).toContain('Use a clean, neutral plain background');
      }
    });

    it('character prompts mention A-pose', () => {
      const prompts = buildIndividualPrompts('character', 'a hero');
      expect(prompts[0]).toContain('A-pose');
      expect(prompts[3]).toContain('A-pose');
    });

    it('location prompts mention aerial for panel 4', () => {
      const prompts = buildIndividualPrompts('location', 'a castle');
      expect(prompts[3]).toContain('Aerial');
    });

    it('vehicle prompts mention interior for panel 6', () => {
      const prompts = buildIndividualPrompts('vehicle', 'a sports car');
      expect(prompts[5]).toContain('Interior');
    });
  });

  describe('createElementImage', () => {
    it('creates image with defaults', () => {
      const img = createElementImage({ url: 'https://example.com/img.png' });
      expect(img.url).toBe('https://example.com/img.png');
      expect(img.source).toBe('generated');
      expect(img.id).toBeDefined();
      expect(img.createdAt).toBeDefined();
    });

    it('creates image with provided values', () => {
      const img = createElementImage({
        id: 'custom-id',
        url: 'https://example.com/img.png',
        createdAt: '2024-01-01T00:00:00Z',
        source: 'upload',
      });
      expect(img.id).toBe('custom-id');
      expect(img.source).toBe('upload');
    });
  });

  describe('createElement', () => {
    it('creates element with defaults', () => {
      const el = createElement({ name: 'Test', type: 'character' });
      expect(el.name).toBe('Test');
      expect(el.type).toBe('character');
      expect(el.description).toBe('');
      expect(el.images).toEqual([]);
      expect(el.id).toBeDefined();
      expect(el.createdAt).toBeDefined();
    });

    it('creates element with images', () => {
      const img = createElementImage({ url: 'https://example.com/img.png' });
      const el = createElement({ name: 'Hero', type: 'character', images: [img] });
      expect(el.images).toHaveLength(1);
      expect(el.images[0].url).toBe('https://example.com/img.png');
    });
  });

  describe('ELEMENT_TYPES', () => {
    it('has exactly 4 types matching CineGen', () => {
      expect(ELEMENT_TYPES).toEqual(['character', 'location', 'prop', 'vehicle']);
      expect(ELEMENT_TYPES).toHaveLength(4);
    });
  });
});
