// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/resultActions/download.js', () => ({ downloadMedia: vi.fn(async () => ({ ok: true, method: 'blob', filename: 'x.mp4' })) }));
vi.mock('../../../lib/resultActions/getLink.js', () => ({ getLink: vi.fn() }));
vi.mock('../../../lib/socialPublishHelpers.js', () => ({ openSocialPublish: vi.fn() }));

import { createResultBar } from '../resultBar.js';
import { downloadMedia } from '../../../lib/resultActions/download.js';
import { getLink } from '../../../lib/resultActions/getLink.js';
import { openSocialPublish } from '../../../lib/socialPublishHelpers.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
const buttons = (bar) => [...bar.el.querySelectorAll('button')];
const byText = (bar, re) => buttons(bar).find((b) => re.test(b.textContent));

describe('createResultBar', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('is disabled until there is a result, then enabled', () => {
    const bar = createResultBar({ kind: 'video' });
    expect(buttons(bar).every((b) => b.disabled)).toBe(true);
    bar.setUrl('https://cdn.x/a.mp4');
    expect(buttons(bar).every((b) => !b.disabled)).toBe(true);
    expect(byText(bar, /Download MP4/)).toBeTruthy();
  });

  it('Download, Get link and Publish all use the CURRENT url (captions update every button)', async () => {
    const bar = createResultBar({ kind: 'video', filename: 'video-1' });
    bar.setUrl('https://cdn.x/original.mp4', { filename: 'video-9', title: 'Prompt' });
    bar.setUrl('blob:captioned-1');
    byText(bar, /Download MP4/).click(); await tick();
    expect(downloadMedia).toHaveBeenCalledWith('blob:captioned-1', expect.objectContaining({ filename: 'video-9', kind: 'video' }));
    byText(bar, /Publish to Social/).click();
    expect(openSocialPublish).toHaveBeenCalledWith({ mediaUrl: 'blob:captioned-1', mediaType: 'video', title: 'Prompt' });
    getLink.mockResolvedValue({ fileUrl: 'https://s.co/storage/v1/object/public/uploads/a.mp4', watchUrl: 'https://smartvid.app/watch/vabc', canonicalUrl: null, pageError: null, reused: false });
    byText(bar, /Get link/).click(); await tick(); await tick();
    expect(getLink).toHaveBeenCalledWith(expect.objectContaining({ url: 'blob:captioned-1', kind: 'video', title: 'Prompt' }));
  });

  it('shows the links it got, with copy and open, and clears them when the result changes', async () => {
    const bar = createResultBar({ kind: 'video' });
    const onLink = vi.fn();
    const withCb = createResultBar({ kind: 'video', onLink });
    getLink.mockResolvedValue({ fileUrl: 'https://s.co/f.mp4', watchUrl: 'https://smartvid.app/watch/vabc', canonicalUrl: 'https://smartvid.app/v/acme/promo', pageError: null, reused: false });
    withCb.setUrl('https://cdn.x/a.mp4');
    byText(withCb, /Get link/).click(); await tick(); await tick();
    const inputs = [...withCb.el.querySelectorAll('input')].map((i) => i.value);
    expect(inputs).toEqual(['https://s.co/f.mp4', 'https://smartvid.app/watch/vabc', 'https://smartvid.app/v/acme/promo']);
    expect([...withCb.el.querySelectorAll('a')].every((a) => a.rel.includes('noopener') && a.target === '_blank')).toBe(true);
    expect(onLink).toHaveBeenCalledTimes(1);
    withCb.setUrl('https://cdn.x/next.mp4');
    expect(withCb.el.querySelectorAll('input')).toHaveLength(0);
    expect(bar.el.querySelector('[role="status"]').getAttribute('aria-live')).toBe('polite');
  });

  it('shows the page-link problem but keeps the file link', async () => {
    const bar = createResultBar({ kind: 'video' });
    getLink.mockResolvedValue({ fileUrl: 'https://s.co/f.mp4', watchUrl: null, canonicalUrl: null, pageError: 'Guests can publish up to 10 videos.', reused: false });
    bar.setUrl('https://cdn.x/a.mp4');
    byText(bar, /Get link/).click(); await tick(); await tick();
    expect(bar.el.querySelectorAll('input')).toHaveLength(1);
    expect(bar.el.querySelector('[role="status"]').textContent).toMatch(/up to 10 videos/);
  });

  it('shows a clear message when the link cannot be made, and the buttons work again', async () => {
    const bar = createResultBar({ kind: 'video' });
    getLink.mockRejectedValue(new Error('Could not copy this file. Download it and upload it from your computer instead.'));
    bar.setUrl('https://cdn.x/a.mp4');
    byText(bar, /Get link/).click(); await tick(); await tick();
    expect(bar.el.querySelector('[role="status"]').textContent).toMatch(/Could not copy/);
    expect(byText(bar, /Get link/).disabled).toBe(false);
    expect(byText(bar, /Download MP4/).disabled).toBe(false);
  });

  it('never turns an address into markup', () => {
    const evil = 'https://x.io/a.mp4"><img src=x onerror=alert(1)>';
    const bar = createResultBar({ kind: 'video' });
    bar.setUrl(evil);
    expect(bar.el.querySelector('img')).toBeNull();
    const links = createResultBar({ kind: 'video' });
    getLink.mockResolvedValue({ fileUrl: evil, watchUrl: null, canonicalUrl: null, pageError: null, reused: false });
    links.setUrl('https://cdn.x/a.mp4');
    byText(links, /Get link/).click();
    return tick().then(tick).then(() => {
      expect(links.el.querySelector('img')).toBeNull();
      expect(links.el.querySelector('input').value).toBe(evil);
    });
  });

  it('hides Publish for audio, relabels downloads, and honours showLink / extra actions', () => {
    const audio = createResultBar({ kind: 'audio' });
    audio.setUrl('https://cdn.x/a.mp3');
    expect(byText(audio, /Download audio/)).toBeTruthy();
    expect(byText(audio, /Publish to Social/).hidden).toBe(true);
    const onClick = vi.fn();
    const bar = createResultBar({ kind: 'video', showLink: false, extraActions: [{ id: 'x', label: 'Extend', onClick }, { label: 'Only audio', onClick, when: (k) => k === 'audio' }] });
    bar.setUrl('https://cdn.x/a.mp4');
    expect(byText(bar, /Get link/)).toBeUndefined();
    byText(bar, /Extend/).click();
    expect(onClick).toHaveBeenCalledWith('https://cdn.x/a.mp4');
    expect(byText(bar, /Only audio/).hidden).toBe(true);
  });
});
