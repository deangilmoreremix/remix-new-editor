import { describe, it, expect, vi } from 'vitest';
import { buildThumbnailPrompt, buildBriefFromSocialCopy } from '../src/lib/thumbnailPromptBuilder.js';

vi.mock('../src/lib/thumbnailPlatformSpecs.js', () => ({
  getPlatformInjectionText: (platform) => {
    if (!platform) return null;
    return `Platform (${platform}): optimized for ${platform}`;
  },
  PLATFORM_SPECS: {},
}));

vi.mock('../src/lib/thumbnailPresets.js', () => ({
  applyPresetToBrief: (preset, baseBrief) => {
    if (!preset || !preset.briefModifier) return baseBrief;
    return `${baseBrief}\n\nStyle direction: ${preset.briefModifier}`;
  },
  getPresetForTemplate: () => null,
  THUMBNAIL_PRESETS: {},
  PRESET_LIST: [],
  DEFAULT_PRESET_KEY: 'default',
}));

describe('thumbnailPromptBuilder', () => {
  const sampleTemplate = {
    id: 'bold-headline',
    name: 'Bold Headline',
    promptRecipe: {
      baseStyle: 'bold editorial design, high contrast',
      composition: 'Headline dominates the frame',
      subjectRules: 'Single headline phrase in massive sans-serif type',
      referenceRules: 'No reference images needed',
      textRules: 'Render the headline text directly inside the image',
      finishingRules: 'High detail, clean edges, no watermarks',
    },
  };

  describe('buildThumbnailPrompt', () => {
    it('includes brief when provided', () => {
      const result = buildThumbnailPrompt({ template: sampleTemplate, brief: 'Some brief context' });
      expect(result).toContain('Brief: Some brief context');
    });

    it('includes customPrompt when provided', () => {
      const result = buildThumbnailPrompt({ template: sampleTemplate, customPrompt: 'extra details here' });
      expect(result).toContain('Additional instructions: extra details here');
    });

    it('includes preset briefModifier when provided', () => {
      const result = buildThumbnailPrompt({
        template: sampleTemplate,
        preset: { briefModifier: 'cinematic widescreen style' },
      });
      expect(result).toContain('Style direction: cinematic widescreen style');
    });

    it('handles template.promptRecipe fields', () => {
      const result = buildThumbnailPrompt({ template: sampleTemplate });
      expect(result).toContain('Base style: bold editorial design, high contrast');
      expect(result).toContain('Composition: Headline dominates the frame');
      expect(result).toContain('Subject: Single headline phrase in massive sans-serif type');
      expect(result).toContain('Finish: High detail, clean edges, no watermarks');
    });

    it('returns fallback for empty input with no template', () => {
      const result = buildThumbnailPrompt({});
      expect(result).toBe('Social media thumbnail, eye-catching, high quality');
    });

    it('includes platform injection when platform is provided', () => {
      const result = buildThumbnailPrompt({ template: sampleTemplate, platform: 'youtube' });
      expect(result).toContain('Platform (youtube): optimized for youtube');
    });

    it('includes userValues as Fields section', () => {
      const result = buildThumbnailPrompt({
        template: sampleTemplate,
        userValues: { headline: 'Test Headline', tone: 'bold' },
      });
      expect(result).toContain('Fields:');
      expect(result).toContain('headline: "Test Headline"');
      expect(result).toContain('tone: "bold"');
    });

    it('assembles multiple parts separated by double newlines', () => {
      const result = buildThumbnailPrompt({
        template: sampleTemplate,
        brief: 'My brief',
        customPrompt: 'Custom',
        platform: 'tiktok',
        preset: { briefModifier: 'style dir' },
      });
      const parts = result.split('\n\n');
      expect(parts.length).toBeGreaterThan(3);
    });

    it('omits absent sections when options are missing', () => {
      const result = buildThumbnailPrompt({ template: sampleTemplate });
      expect(result).not.toContain('Brief:');
      expect(result).not.toContain('Additional instructions:');
      expect(result).not.toContain('Style direction:');
    });
  });

  describe('buildBriefFromSocialCopy', () => {
    it('extracts headline from caption', () => {
      const result = buildBriefFromSocialCopy('Check out this new launch. More info!', []);
      expect(result.headline).toBe('Check out this new launch');
    });

    it('extracts hashtags', () => {
      const result = buildBriefFromSocialCopy('My post #marketing #viral', []);
      expect(result.hashtags).toEqual(['marketing', 'viral']);
    });

    it('includes platform names in brief', () => {
      const result = buildBriefFromSocialCopy('My post #test', ['youtube', 'tiktok']);
      expect(result.brief).toContain('youtube, tiktok');
    });

    it('falls back to first 80 chars when no sentence-ending punctuation', () => {
      const longCaption = 'A'.repeat(200);
      const result = buildBriefFromSocialCopy(longCaption, []);
      expect(result.headline.length).toBeLessThanOrEqual(80);
    });

    it('returns empty hashtags when none in caption', () => {
      const result = buildBriefFromSocialCopy('No hashtags here', []);
      expect(result.hashtags).toEqual([]);
    });

    it('uses multi-platform fallback when no platforms provided', () => {
      const result = buildBriefFromSocialCopy('Caption here #test', []);
      expect(result.brief).toContain('multi-platform');
    });

    it('builds a prompt using buildThumbnailPrompt with template opts', () => {
      const template = {
        id: 'test',
        promptRecipe: {
          baseStyle: 'style',
          composition: 'comp',
          subjectRules: 'subj',
          referenceRules: 'ref',
          textRules: 'text',
          finishingRules: 'finish',
        },
      };
      const result = buildBriefFromSocialCopy('My post #test', ['instagram'], { template });
      expect(result.prompt).toContain('Brief: My post #test — test — instagram');
      expect(result.prompt).toContain('Platform (instagram)');
      expect(result.prompt).toContain('Base style: style');
    });

    it('passes customPrompt and preset through opts', () => {
      const result = buildBriefFromSocialCopy('My post', [], {
        customPrompt: 'Make it pop',
        preset: { briefModifier: 'vivid style' },
      });
      expect(result.prompt).toContain('Additional instructions: Make it pop');
      expect(result.prompt).toContain('Style direction: vivid style');
    });
  });
});
