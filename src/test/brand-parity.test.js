import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/muapi.js', () => ({
  muapi: { text: vi.fn(), image2: vi.fn(), imageEdit2: vi.fn() },
  MuapiClient: class {},
}));
vi.mock('../lib/brandStore.js', () => ({ generateId: () => 'id-1' }));

const { muapi } = await import('../lib/muapi.js');
const gen = await import('../lib/campaignGenerator.js');
const { PLATFORMS } = await import('../lib/platforms.js');
const { toHex, pickPalette } = await import('../lib/colors.js');

const brand = {
  brandName: 'Acme', industry: 'Roofing', tagline: 'Roofs that last', valueProposition: 'Durable roofs',
  targetAudience: 'Homeowners', toneOfVoice: ['direct', 'warm'], brandPersonality: ['reliable'],
  keyMessages: ['Built to last'], primaryColors: ['#112233'], secondaryColors: ['#ff5500'],
  imageryStyle: 'editorial', layoutStyle: 'bold', logoUrl: 'https://acme.example/logo.png',
};
const concept = { title: 'Storm Proof', theme: 'Safety', hook: 'Sleep easy', key_message: 'Built to last', cta: 'Get a quote', tone_notes: 'calm', visual_direction: 'Slate roof at dusk' };

afterEach(() => vi.clearAllMocks());

describe('campaign prompts match Open-Pomelli', () => {
  it('builds the strategist prompt with the full brand block and exactly 4 concepts', () => {
    const p = gen.buildCampaignPrompt(brand, 'lead-gen', 'focus on spring');
    expect(p).toMatch(/senior brand strategist/);
    expect(p).toMatch(/exactly 4 distinct/);
    expect(p).toContain('Value proposition: Durable roofs');
    expect(p).toContain('Primary colors: #112233');
    expect(p).toContain('USER DIRECTION: focus on spring');
    expect(p).toContain('"instagram-feed"');
  });

  it.each([
    ['a bare array', '[{"title":"A"},{"title":"B"}]'],
    ['a fenced array', '```json\n[{"title":"A"},{"title":"B"}]\n```'],
    ['{concepts:[...]}', '{"concepts":[{"title":"A"},{"title":"B"}]}'],
  ])('parses %s', (_, raw) => {
    const out = gen.parseConcepts(raw);
    expect(out.map((c) => c.title)).toEqual(['A', 'B']);
  });

  it('keeps at most 4 concepts and throws on garbage', () => {
    const six = JSON.stringify(Array.from({ length: 6 }, (_, i) => ({ title: `T${i}` })));
    expect(gen.parseConcepts(six)).toHaveLength(4);
    expect(() => gen.parseConcepts('no json here')).toThrow(/concepts array/);
  });

  it('asks for an empty body/cta when the platform cap is 0 (YouTube)', () => {
    const p = gen.buildCopyPrompt(brand, concept, 'youtube');
    expect(p).toContain('"body": "string (max 0 words — return empty string)"');
    expect(p).toContain('"cta": "string (max 0 words — return empty string)"');
    expect(p).toContain('- Voice: direct, warm');
  });

  it('puts palette, styles and the platform image hint into the image prompt', () => {
    const p = gen.buildImagePrompt(brand, concept, 'instagram-story', 'Sleep easy', { noText: false });
    expect(p).toContain('Primary palette: #112233. Accent palette: #ff5500.');
    expect(p).toContain('Imagery style: editorial. Layout style: bold.');
    expect(p).toContain('bottom 20% reserved for app UI');
    expect(p).toContain('Overlay headline (large, on-brand typography): "Sleep easy"');
    expect(gen.buildImagePrompt(brand, concept, 'instagram-story', 'x', { noText: true })).toContain('render NO text');
  });
});

describe('asset generation', () => {
  it('sends only the logo as the reference image and truncates to the caps (0 cap -> empty)', async () => {
    muapi.text.mockResolvedValue('{"headline":"one two three four five six seven","body":"should vanish","cta":"buy now please"}');
    muapi.imageEdit2.mockResolvedValue('https://img.example/a.png');
    const asset = await gen.generateAssetForConcept(brand, concept, 'youtube');
    expect(asset.headline).toBe('one two three four five');
    expect(asset.body).toBe('');
    expect(asset.cta).toBe('');
    const [, refs, opts] = muapi.imageEdit2.mock.calls[0];
    expect(refs).toEqual(['https://acme.example/logo.png']);
    expect(opts.aspectRatio).toBe('16:9');
    expect(asset.platform).toBe('youtube');
  });

  it('uses text-to-image when the brand has no logo', async () => {
    muapi.text.mockResolvedValue('{"headline":"Hi","body":"Body","cta":"Go"}');
    muapi.image2.mockResolvedValue('https://img.example/b.png');
    const asset = await gen.generateAssetForConcept({ ...brand, logoUrl: null }, concept, 'instagram-feed');
    expect(muapi.imageEdit2).not.toHaveBeenCalled();
    expect(asset.imageUrl).toBe('https://img.example/b.png');
  });
});

describe('platforms', () => {
  it('uses upstream copy caps and consistent aspect/size', () => {
    const by = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));
    expect(by['instagram-story'].copy.bodyMaxWords).toBe(0);
    expect(by.youtube.copy).toMatchObject({ headlineMaxWords: 5, bodyMaxWords: 0, ctaMaxWords: 0 });
    expect(by.linkedin.copy).toMatchObject({ headlineMaxWords: 10, bodyMaxWords: 35, ctaMaxWords: 3 });
    for (const p of PLATFORMS) {
      const [aw, ah] = p.aspect.split(':').map(Number);
      expect(Math.abs(p.width / p.height - aw / ah)).toBeLessThan(0.01);
    }
  });
});

describe('colors', () => {
  it('converts hex, rgb and hsl and ranks by frequency', () => {
    expect(toHex('#abc')).toBe('#aabbcc');
    expect(toHex('rgb(1, 2, 3)')).toBe('#010203');
    expect(toHex('hsl(0 100% 50%)')).toBe('#ff0000');
    expect(toHex('hsla(120, 100%, 25%, .5)')).toBe('#008000');
    expect(toHex('nonsense')).toBeNull();
    expect(pickPalette(['#112233', '#112233', 'rgb(255, 85, 0)']).primary[0]).toBe('#112233');
  });
});
