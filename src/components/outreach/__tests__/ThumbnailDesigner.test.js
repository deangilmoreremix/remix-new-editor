// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../../lib/outreach/thumbnail.js', async (orig) => {
  const real = await orig();
  return { ...real, drawThumbnail: vi.fn(), grabFrames: vi.fn(async () => [{}]), renderThumbnail: vi.fn(async () => new Blob(['x'], { type: 'image/gif' })) };
});
import * as T from '../../../lib/outreach/thumbnail.js';
import { sampleTimes } from '../../../lib/outreach/thumbnailPick.js';
import { openThumbnailDesigner } from '../ThumbnailDesigner.js';

const $ = (s) => document.querySelector(s);
const draftOf = () => ({
  video: { url: '', duration: 20 },
  email: { thumbText: 'Hi {{firstname}}, this is for you', thumb: { type: 'gif', start: 1 } },
  fallbacks: { firstname: 'there' },
  contacts: [{ id: 'c1', firstName: 'Mike', company: 'Linear', website: 'https://linear.app' }, { id: 'c2', firstName: 'Priya', company: 'Notion' }],
});

describe('thumbnail designer', () => {
  beforeEach(() => { document.body.innerHTML = ''; T.drawThumbnail.mockClear(); });

  it('draws each prospect’s picture and saves every choice on the dynamic video', () => {
    const draft = draftOf(); const save = vi.fn();
    openThumbnailDesigner({ draft, save });
    expect($('[data-thumb-designer]')).not.toBeNull();
    expect(T.drawThumbnail.mock.calls.at(-1)[1].text).toBe('Hi Mike, this is for you');
    const sel = $('[data-thumb-who]'); sel.value = 'c2'; sel.dispatchEvent(new Event('change'));
    expect(T.drawThumbnail.mock.calls.at(-1)[1].text).toBe('Hi Priya, this is for you');
    $('[data-thumb-type="static"]').click();
    expect(draft.email.thumb.type).toBe('static');
    $('[data-thumb-bg="video"]').click();
    expect(draft.email.thumb.background).toBe('video');
    const text = $('[data-thumb-text]'); text.value = 'For {{company}}'; text.dispatchEvent(new Event('input'));
    expect(draft.email.thumbText).toBe('For {{company}}');
    expect(T.drawThumbnail.mock.calls.at(-1)[1].text).toBe('For Notion');
    $('[data-thumb-logo-mode="none"]').click();
    expect(draft.email.thumb.logoMode).toBe('none');
    expect(save).toHaveBeenCalled();
  });

  it('an image of yours goes behind the bubble once uploaded', async () => {
    const draft = draftOf();
    const upload = vi.fn(async () => 'https://cdn.test/mine.jpg');
    openThumbnailDesigner({ draft, upload });
    const input = $('[data-thumb-image-file]');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(draft.email.thumb).toMatchObject({ background: 'image', image: 'https://cdn.test/mine.jpg' }));
    expect(T.thumbBackground(T.thumbSettings(draft.email.thumb), 'https://shot.test/site.jpg')).toBe('https://cdn.test/mine.jpg');
  });

  it('Make thumbnails closes and makes them; without prospects there is no Make button and a sample shows', () => {
    const onMake = vi.fn(); const onClose = vi.fn();
    openThumbnailDesigner({ draft: draftOf(), onMake, onClose });
    $('[data-thumb-make]').click();
    expect(onMake).toHaveBeenCalled(); expect(onClose).toHaveBeenCalled();
    expect($('[data-thumb-designer]')).toBeNull();
    const d = draftOf(); d.contacts = [];
    openThumbnailDesigner({ draft: d });
    expect($('[data-thumb-make]')).toBeNull();
    expect(document.body.textContent).toContain('sample prospect');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect($('[data-thumb-designer]')).toBeNull();
  });

  it('backgrounds: as in the video, just the video, or an image', () => {
    const s = (t) => T.thumbSettings(t);
    expect(T.thumbBackground(s({}), 'site.jpg')).toBe('site.jpg');
    expect(T.thumbBackground(s({ background: 'video' }), 'site.jpg')).toBe('');
    expect(T.thumbBackground(s({ background: 'image', image: 'https://x.test/a.jpg' }), 'site.jpg')).toBe('https://x.test/a.jpg');
    expect(s({ background: 'image' }).background).toBe('auto'); // no image yet
  });

  it('Sendspark\u2019s three tabs; fallbacks, one logo (found or uploaded), colours and the duration badge', async () => {
    const draft = draftOf(); draft.video.duration = 26.5;
    const findLogo = vi.fn(async () => 'https://cdn.test/acme-logo.png');
    const upload = vi.fn(async () => 'https://cdn.test/my-logo.png');
    openThumbnailDesigner({ draft, findLogo, upload });
    const tab = (k) => $(`[data-thumb-tab="${k}"]`);
    expect(tab('main').getAttribute('aria-selected')).toBe('true');
    tab('styles').click();
    expect(tab('styles').getAttribute('aria-selected')).toBe('true');
    expect($('[data-thumb-text]').closest('[hidden]')).not.toBeNull();
    // Fallback: "Hi there" when a prospect has no first name.
    tab('main').click();
    const fb = $('[data-thumb-fallback="firstname"]'); fb.value = 'friend'; fb.dispatchEvent(new Event('input'));
    expect(draft.fallbacks.firstname).toBe('friend');
    // One logo: find it by website.
    $('[data-thumb-logo-mode="one"]').click();
    expect($('[data-thumb-one-logo]').hidden).toBe(false);
    $('[data-thumb-logo-domain]').value = 'acme.com';
    $('[data-thumb-logo-find]').click();
    await vi.waitFor(() => expect(draft.email.thumb).toMatchObject({ logoMode: 'one', logoUrl: 'https://cdn.test/acme-logo.png' }));
    expect(findLogo).toHaveBeenCalledWith('acme.com');
    // ...or upload one.
    const f = $('[data-thumb-logo-file]');
    Object.defineProperty(f, 'files', { value: [new File(['x'], 'l.png', { type: 'image/png' })] });
    f.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(draft.email.thumb.logoUrl).toBe('https://cdn.test/my-logo.png'));
    // Edit Styles.
    tab('styles').click();
    const tc = $('[data-thumb-color="textColor"]'); tc.value = '#ffcc00'; tc.dispatchEvent(new Event('input'));
    const bc = $('[data-thumb-color="bannerColor"]'); bc.value = '#112233'; bc.dispatchEvent(new Event('input'));
    const dur = $('[data-thumb-duration]'); dur.checked = false; dur.dispatchEvent(new Event('change'));
    expect(draft.email.thumb).toMatchObject({ textColor: '#ffcc00', bannerColor: '#112233', duration: { show: false } });
    const last = T.drawThumbnail.mock.calls.at(-1)[1];
    expect(last).toMatchObject({ textColor: '#ffcc00', bannerColor: '#112233', seconds: 26.5 });
  });

  describe('Suggest best moments', () => {
    const fake = (kind) => {
      const w = 160; const h = 90; const data = new Uint8ClampedArray(w * h * 4);
      for (let p = 0; p < w * h; p += 1) {
        const v = kind === 'sharp' ? ((p + Math.floor(p / w)) % 2 ? 230 : 20) : 120;
        data.set([v, v, v, 255], p * 4);
      }
      return { getContext: () => ({ getImageData: () => ({ data, width: w, height: h }) }) };
    };
    const withVideo = () => { const d = draftOf(); d.video = { url: 'v.mp4', duration: 20 }; return d; };

    it('shows the top 3 in score order and a chip sets the start', async () => {
      // 8 frames: the 2nd, 5th and 7th are sharp (equal scores, so earliest first); the rest flat.
      const kinds = ['flat', 'sharp', 'flat', 'flat', 'sharp', 'flat', 'sharp', 'flat'];
      let n = 0;
      T.grabFrames.mockImplementation(async () => [fake(kinds[n++])]);
      const draft = withVideo();
      openThumbnailDesigner({ draft });
      $('[data-thumb-suggest]').click();
      expect($('[data-thumb-suggest]').disabled).toBe(true);
      await vi.waitFor(() => expect(document.querySelectorAll('[data-thumb-suggestion]').length).toBe(3));
      const times = sampleTimes(20, 8);
      const chips = [...document.querySelectorAll('[data-thumb-suggestion]')];
      expect(chips.map((c) => c.dataset.thumbSuggestion)).toEqual([times[1], times[4], times[6]].map(String));
      expect(chips[0].textContent).toMatch(/0:\d\d/);
      expect(chips[0].textContent).toContain('sharp');
      expect(document.body.textContent).toContain('Ranked by sharpness, lighting and contrast');
      expect($('[data-thumb-suggest]').disabled).toBe(false);
      chips[1].click();
      expect(draft.email.thumb.start).toBe(times[4]);
      expect(Number($('[data-thumb-start]').value)).toBe(times[4]);
    });

    it('only suggests moments the scrubber can select, so the shown time is the saved start', async () => {
      const kinds = ['flat', 'flat', 'flat', 'flat', 'flat', 'sharp', 'sharp', 'sharp'];
      let n = 0;
      T.grabFrames.mockImplementation(async () => [fake(kinds[n++])]);
      const draft = withVideo(); draft.video.duration = 20.06; // GIF maximum start is 17.06
      openThumbnailDesigner({ draft });
      $('[data-thumb-suggest]').click();
      await vi.waitFor(() => expect(document.querySelectorAll('[data-thumb-suggestion]').length).toBeGreaterThan(0));
      const max = Number($('[data-thumb-start]').max);
      const chips = [...document.querySelectorAll('[data-thumb-suggestion]')];
      chips.forEach((c) => expect(Number(c.dataset.thumbSuggestion)).toBeLessThanOrEqual(max));
      chips.forEach((c) => { c.click(); expect(draft.email.thumb.start).toBe(Number(c.dataset.thumbSuggestion)); });
    });

    it('clears suggestions when the thumbnail type changes the allowed range', async () => {
      T.grabFrames.mockImplementation(async () => [fake('sharp')]);
      const draft = withVideo();
      openThumbnailDesigner({ draft });
      $('[data-thumb-suggest]').click();
      await vi.waitFor(() => expect(document.querySelectorAll('[data-thumb-suggestion]').length).toBe(3));
      $('[data-thumb-type="static"]').click();
      expect(document.querySelectorAll('[data-thumb-suggestion]').length).toBe(0);
    });

    it('says so when the video cannot be read (tainted canvas)', async () => {
      T.grabFrames.mockImplementation(async () => [{ getContext: () => ({ getImageData: () => { throw new Error('tainted canvas'); } }) }]);
      openThumbnailDesigner({ draft: withVideo() });
      $('[data-thumb-suggest]').click();
      await vi.waitFor(() => expect($('[data-thumb-suggest-status]').textContent).toBe('This video cannot be analysed here. Pick a moment with the scrubber.'));
      expect(document.querySelectorAll('[data-thumb-suggestion]').length).toBe(0);
      expect($('[data-thumb-suggest]').disabled).toBe(false);
    });

    it('shows progress, and Cancel stops the run', async () => {
      let release; let calls = 0;
      T.grabFrames.mockImplementation(() => { calls += 1; return new Promise((r) => { release = () => r([fake('sharp')]); }); });
      openThumbnailDesigner({ draft: withVideo() });
      $('[data-thumb-suggest]').click();
      await vi.waitFor(() => expect($('[data-thumb-suggest-status]').textContent).toBe('Looking at frame 1 of 8…'));
      $('[data-thumb-suggest-cancel]').click();
      release();
      await vi.waitFor(() => expect($('[data-thumb-suggest-status]').textContent).toBe('Stopped.'));
      expect(calls).toBe(1);
      expect(document.querySelectorAll('[data-thumb-suggestion]').length).toBe(0);
      expect($('[data-thumb-suggest]').disabled).toBe(false);
    });
  });
});
