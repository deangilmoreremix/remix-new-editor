// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

const muapiMock = vi.hoisted(() => ({ text: vi.fn(), image: vi.fn(), imageEdit: vi.fn(), imageEdit2: vi.fn(), videoI2V: vi.fn(), generateI2V: vi.fn(), uploadBrandAsset: vi.fn() }));
vi.mock('../lib/muapi.js', () => ({ muapi: muapiMock, MuapiClient: class {} }));

const BRAND = { id: 'b1', brandName: 'Acme <b>Co</b>', industry: 'x', logoUrl: 'https://x/logo.png', primaryColors: ['#112233'], toneOfVoice: [], brandPersonality: [], keyMessages: [] };
const at = (search) => window.history.replaceState({}, '', `/${search}#/x`);

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); at('?brandId=b1');
  localStorage.setItem('brand_dna_list', JSON.stringify([BRAND]));
});

describe('recommended platforms', () => {
  it('matches ids, families and the model\'s loose names', async () => {
    const { PLATFORMS, isRecommendedPlatform } = await import('../lib/platforms.js');
    const ids = (rec) => PLATFORMS.filter((p) => isRecommendedPlatform(p, rec)).map((p) => p.id);
    expect(ids(['instagram'])).toEqual(['instagram-feed', 'instagram-story']); // a family means all its formats
    expect(ids(['instagram-story', 'linkedin'])).toEqual(['instagram-story', 'linkedin']);
    expect(ids(['banner', 'youtube_thumb', 'email'])).toEqual(['web-banner', 'email', 'youtube']);
    expect(ids(['LinkedIn', 'Twitter'])).toEqual(['linkedin', 'twitter']);
    expect(ids([])).toEqual([]);
    expect(ids(undefined)).toEqual([]);
    expect(ids(['google_ad', 'tiktok'])).toEqual([]); // unknown names select nothing, no error
  });
});

describe('campaign wizard', () => {
  const run = async (concept) => {
    muapiMock.text.mockResolvedValue(JSON.stringify({ concepts: [concept] }));
    const { CampaignWizard } = await import('../components/CampaignWizard.js');
    const el = CampaignWizard();
    [...el.querySelectorAll('div.cursor-pointer')].find((d) => d.textContent.includes('Product Launch')).click();
    el.querySelector('button[data-action="generate-concepts"]').click();
    await vi.waitFor(() => expect(el.querySelector('button[data-action="select-concept"]')).toBeTruthy());
    return el;
  };
  const concept = { title: 'T <img src=x onerror="window.__xss=1">', theme: 'th', key_message: 'km', hook: 'The hook', cta: 'Go', tone_notes: 'warm', visual_direction: 'Neon skyline', recommended_platforms: ['instagram', 'banner'] };

  it('shows Hook, Key message, CTA, Tone and Visual on each concept, as text not markup', async () => {
    const el = await run(concept);
    const card = el.querySelector('button[data-action="select-concept"]').closest('div.cursor-pointer');
    for (const t of ['Hook', 'The hook', 'Key message', 'CTA', 'Tone', 'warm', 'Visual', 'Neon skyline']) expect(card.textContent).toContain(t);
    expect(card.querySelector('img')).toBeNull();
    expect(window.__xss).toBeUndefined();
  });
  it('ticks the recommended platforms when a concept is chosen, counts them, and labels the button', async () => {
    const el = await run(concept);
    el.querySelector('button[data-action="select-concept"]').click();
    const on = [...el.querySelectorAll('button[data-platform]')].filter((b) => b.className.includes('bg-primary')).map((b) => b.dataset.platform);
    expect(on).toEqual(['instagram-feed', 'instagram-story', 'web-banner']);
    expect(el.querySelector('[data-selected-count]').textContent).toBe('3 selected');
    const gen = el.querySelector('button[data-action="generate-assets"]');
    expect(gen.textContent).toBe('Generate 3');
    expect(gen.disabled).toBe(false);
  });
  it('the count and button follow every tick and untick; with none ticked the button is disabled', async () => {
    const el = await run({ ...concept, recommended_platforms: [] });
    el.querySelector('button[data-action="select-concept"]').click();
    const gen = el.querySelector('button[data-action="generate-assets"]');
    expect(gen.disabled).toBe(true);
    expect(el.querySelector('[data-selected-count]').textContent).toBe('0 selected');
    el.querySelector('button[data-platform="linkedin"]').click();
    el.querySelector('button[data-platform="youtube"]').click();
    expect(gen.textContent).toBe('Generate 2');
    expect(gen.disabled).toBe(false);
    el.querySelector('button[data-platform="linkedin"]').click();
    expect(gen.textContent).toBe('Generate 1');
  });
});

describe('Photo Studio recent photoshoots', () => {
  const shots = [
    { id: 's1', brandId: 'b1', imageUrl: 'https://img/1.png', styleLabel: 'Scandi living', styleId: 'scandi_living', aspect: '16:9' },
    { id: 's2', brandId: 'b1', imageUrl: 'https://img/2.png', styleLabel: 'Dark techy', styleId: 'dark_techy', aspect: '1:1' },
    { id: 's3', brandId: 'other', imageUrl: 'https://img/3.png', styleLabel: 'Not mine', styleId: 'x', aspect: '1:1' },
  ];
  it('lists this brand\'s saved shots (not other brands\'), with Open and Animate', async () => {
    localStorage.setItem('brand_photoshoots', JSON.stringify(shots));
    const { PhotoStudioPage } = await import('../components/PhotoStudioPage.js');
    const el = PhotoStudioPage();
    const cards = el.querySelectorAll('[data-photoshoot-id]');
    expect([...cards].map((c) => c.dataset.photoshootId)).toEqual(['s1', 's2']);
    expect(el.querySelector('[data-photo-history]').textContent).toContain('Recent photoshoots');
    const open = cards[0].querySelector('a');
    expect(open.getAttribute('href')).toBe('https://img/1.png');
    expect(open.getAttribute('target')).toBe('_blank');
    expect(open.getAttribute('rel')).toContain('noopener');
  });
  it('shows nothing (no empty heading) when the brand has no shots', async () => {
    const { PhotoStudioPage } = await import('../components/PhotoStudioPage.js');
    expect(PhotoStudioPage().querySelector('[data-photo-history]').textContent).toBe('');
  });
  it('a brand name with markup is shown as text in the dropdown', async () => {
    const { PhotoStudioPage } = await import('../components/PhotoStudioPage.js');
    const el = PhotoStudioPage();
    const opt = [...el.querySelectorAll('option')].find((o) => o.textContent.includes('Acme'));
    expect(opt.textContent).toBe('Acme <b>Co</b>');
    expect(el.querySelector('select option b')).toBeNull();
  });
});

describe('Animate: duration slider and deep links', () => {
  const mount = async () => (await import('../components/AnimatePage.js')).AnimatePage();
  it('duration is a 3-12 s slider that updates its label', async () => {
    const el = await mount();
    const slider = el.querySelector('[data-duration-slider]');
    expect([slider.min, slider.max, slider.step]).toEqual(['3', '12', '1']);
    slider.value = '9'; slider.dispatchEvent(new Event('input'));
    expect(el.querySelector('[data-duration-value]').textContent).toBe('9s');
    slider.value = '12'; slider.dispatchEvent(new Event('input'));
    expect(el.querySelector('[data-duration-value]').textContent).toBe('12s');
  });
  it('?image=&sourceType=photoshoot&sourceId= preloads the shot and its motion prompt', async () => {
    localStorage.setItem('brand_photoshoots', JSON.stringify([{ id: 's1', brandId: 'b1', imageUrl: 'https://img/1.png', styleLabel: 'Scandi', styleId: 's' }]));
    at('?brandId=b1&image=' + encodeURIComponent('https://img/1.png') + '&sourceType=photoshoot&sourceId=s1');
    const el = await mount();
    expect(el.querySelector('img[alt="Source image"]').getAttribute('src')).toBe('https://img/1.png');
    expect(el.querySelector('textarea').value).toMatch(/Slow rotational camera move/);
    expect(el.querySelector('select').value).toBe('s1'); // the matching photoshoot is selected
  });
  it('?sourceType=asset and the upload default pick the right source and prompt', async () => {
    at('?image=' + encodeURIComponent('https://img/a.png') + '&sourceType=asset');
    expect((await mount()).querySelector('textarea').value).toMatch(/push-in toward the focal subject/);
    at('?image=' + encodeURIComponent('https://img/u.png'));
    expect((await mount()).querySelector('textarea').value).toMatch(/Cinematic motion that suits the image/);
  });
  it('refuses a non-http(s) image link (no javascript:/data: into the page)', async () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', '//evil.test/x.png', 'ftp://x/y.png']) {
      at('?image=' + encodeURIComponent(bad));
      expect((await mount()).querySelector('img[alt="Source image"]')).toBeNull();
    }
  });
});
