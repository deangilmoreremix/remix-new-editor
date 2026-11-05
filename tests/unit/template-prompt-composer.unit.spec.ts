import { describe, it, expect } from 'vitest';
import { composeTemplatePrompt, defaultCreativeTiles, detectTemplateNiche } from '../../src/lib/templatePromptComposer.js';
import { getTemplateById, allTemplates } from '../../src/lib/templates.js';
import { normalizeTemplate } from '../../src/lib/templateAdapter.js';
import { getTemplateSpecs } from '../../src/lib/templateSpecs.js';

const thumbnail = normalizeTemplate(getTemplateById('youtube-thumbnail'));

describe('composeTemplatePrompt: every input reaches the prompt', () => {
  const advanced = {
    templateType: 'dramatic-trailer',
    niche: 'fitness',
    businessType: 'boutique gym',
    audience: 'busy professionals',
    subject: 'coach mid-workout',
    setting: 'neon-lit warehouse gym',
    visualStyle: 'dramatic',
    cta: 'Join today',
    extraInstructions: 'big yellow headline text on the left',
  };
  const tiles = {
    niche: '',
    scene: 'Face close-up → fire background → headline area',
    cinematic: 'Low-angle hero framing',
    style: 'Bold, high-contrast, expressive',
    keywords: 'high click-through thumbnail, bold expression',
  };

  it('image template: main prompt in base prompt + all Advanced Controls + cards', () => {
    const { prompt } = composeTemplatePrompt({
      template: thumbnail,
      userPrompt: 'shocked face reaction with fire background',
      templateInputs: thumbnail.inputs,
      fields: {},
      advanced,
      tiles,
      aiEnhancer: true,
    });
    expect(prompt).toContain('shocked face reaction with fire background, YouTube thumbnail style');
    expect(prompt).toContain('Subject: coach mid-workout');
    expect(prompt).toContain('Business: boutique gym');
    expect(prompt).toContain('Setting: neon-lit warehouse gym');
    expect(prompt).toContain('Target audience: busy professionals');
    expect(prompt).toContain('Visual style: dramatic — Bold, high-contrast, expressive');
    expect(prompt).toContain('Composition: Face close-up → fire background → headline area');
    expect(prompt).toContain('Low-angle hero framing');
    expect(prompt).toContain('Text overlay / call to action: Join today');
    expect(prompt).toContain('big yellow headline text on the left');
    expect(prompt).toContain('high click-through thumbnail, bold expression');
    // Film format does not apply to images.
    expect(prompt).not.toContain('Format:');
  });

  it('video template: format and the template\'s own fields are included', () => {
    const t = normalizeTemplate(allTemplates.find(x => x.id === 'midnight_table_film'));
    const { prompt } = composeTemplatePrompt({
      template: t,
      userPrompt: 'late-night chef plating',
      templateInputs: t.inputs,
      fields: { restaurantName: 'Ember & Oak', cuisine: 'wood-fired Italian', prompt: 'late-night chef plating' },
      advanced: { templateType: 'dramatic-trailer', niche: 'auto-detect' },
      tiles: {},
    });
    expect(prompt).toContain('late-night chef plating');
    expect(prompt).toMatch(/Ember & Oak/);
    expect(prompt).toMatch(/wood-fired Italian/);
    expect(prompt).toContain('Format: dramatic trailer');
  });

  it('settings and media never leak into the prompt text', () => {
    const t = normalizeTemplate(getTemplateById('tiktok-video'));
    const { prompt } = composeTemplatePrompt({
      template: t,
      userPrompt: 'dancing in the rain',
      templateInputs: t.inputs,
      fields: { image_url: 'https://cdn/x.png', aspect_ratio: '9:16', duration: '5', prompt: 'dancing in the rain' },
    });
    expect(prompt).not.toMatch(/cdn\/x\.png|Aspect Ratio|Duration:|image_url/);
  });

  it('niche: explicit choice > edited card > auto-detection', () => {
    const base = { template: thumbnail, userPrompt: 'x', templateInputs: thumbnail.inputs };
    expect(composeTemplatePrompt({ ...base, advanced: { niche: 'fitness' } }).niche).toBe('fitness');
    expect(composeTemplatePrompt({ ...base, advanced: { niche: 'auto-detect' }, tiles: { niche: 'dental' } }).niche).toBe('dental');
    expect(composeTemplatePrompt({ ...base, advanced: { niche: 'auto-detect', businessType: 'italian restaurant' } }).niche).toBe('restaurant');
  });

  it('edited Scene Beats tab wins over the card', () => {
    const { prompt } = composeTemplatePrompt({ template: thumbnail, userPrompt: 'x', tiles: { scene: 'card scene' }, sceneOverride: 'my own beats' });
    expect(prompt).toContain('my own beats');
    expect(prompt).not.toContain('card scene');
  });

  it('AI Enhancer off drops the enhancer keywords', () => {
    const on = composeTemplatePrompt({ template: thumbnail, userPrompt: 'x', tiles: { keywords: 'kw-marker' }, aiEnhancer: true }).prompt;
    const off = composeTemplatePrompt({ template: thumbnail, userPrompt: 'x', tiles: { keywords: 'kw-marker' }, aiEnhancer: false }).prompt;
    expect(on).toContain('kw-marker');
    expect(off).not.toContain('kw-marker');
  });

  it('is stable: composing twice gives the same prompt (no snowballing)', () => {
    const args = { template: thumbnail, userPrompt: 'shocked face', advanced, tiles, templateInputs: thumbnail.inputs };
    expect(composeTemplatePrompt(args).prompt).toBe(composeTemplatePrompt(args).prompt);
  });

  it('works with no main prompt (base prompt filled from subject / template name)', () => {
    const { prompt } = composeTemplatePrompt({ template: thumbnail, userPrompt: '', advanced: { subject: 'gamer winning' } });
    expect(prompt.startsWith('gamer winning, YouTube thumbnail style')).toBe(true);
  });
});

describe('Creative Intelligence defaults', () => {
  it('uses the template specs when present', () => {
    const specs = getTemplateSpecs('youtube-thumbnail') || {};
    const tiles = defaultCreativeTiles('image', specs);
    if (specs.visualStyle) expect(tiles.style).toBe(specs.visualStyle);
    expect(tiles.scene).toBeTruthy();
  });

  it('image templates get image-appropriate defaults', () => {
    const tiles = defaultCreativeTiles('image', {});
    expect(tiles.cinematic).not.toMatch(/camera movement/i);
  });

  it('detects the niche from the template', () => {
    expect(detectTemplateNiche({ template: { name: 'Steakhouse promo', description: 'restaurant film' } })).toBe('restaurant');
  });
});

describe('composeTemplatePrompt / appendMissingInputs: review fixes', () => {
  it('keeps decimals, versions and domains intact', () => {
    const { prompt } = composeTemplatePrompt({ template: thumbnail, userPrompt: 'shot on v2.6 at 2.5x speed for example.com' });
    expect(prompt).toContain('v2.6');
    expect(prompt).toContain('2.5x');
    expect(prompt).toContain('example.com');
  });

  it('adds a niche the user typed that has no enrichment terms', () => {
    const { prompt } = composeTemplatePrompt({ template: thumbnail, userPrompt: 'x', tiles: { niche: 'pottery studio' } });
    expect(prompt).toContain('Niche: pottery studio');
  });

  it('matches whole values only', async () => {
    const { appendMissingInputs } = await import('../../src/lib/templatePromptComposer.js');
    expect(appendMissingInputs('Anamorphic lens aesthetic', [{ label: 'Character', value: 'Ana' }])).toContain('Character: Ana');
    expect(appendMissingInputs('Starring Ana in Lisbon', [{ label: 'Character', value: 'Ana' }])).toBe('Starring Ana in Lisbon');
  });
});

describe('niche templates use their niche terms', () => {
  it('maps display labels ("Restaurant & Cafe") to niche ids for enrichment', async () => {
    const { toNicheKey } = await import('../../src/lib/templatePromptComposer.js');
    expect(toNicheKey('Restaurant & Cafe')).toBe('restaurant');
    expect(toNicheKey('Luxury & Premium')).toBe('luxury-brand');
    expect(toNicheKey('fitness')).toBe('fitness');
    const t = normalizeTemplate(allTemplates.find(x => x.id === 'midnight_table_film'));
    const { niche, prompt } = composeTemplatePrompt({ template: t, userPrompt: 'x', templateInputs: t.inputs });
    expect(niche).toBe('restaurant');
    expect(prompt).not.toMatch(/professional business environment/);
  });

  it('every niche template label maps to a niche with its own terms', async () => {
    const { toNicheKey } = await import('../../src/lib/templatePromptComposer.js');
    const { NICHE_ENRICHMENT } = await import('../../src/lib/templateMatrix.js');
    const labels = [...new Set(allTemplates.map(t => t.niche).filter(Boolean))];
    expect(labels.filter(l => !NICHE_ENRICHMENT[toNicheKey(l)])).toEqual([]);
  });
});
