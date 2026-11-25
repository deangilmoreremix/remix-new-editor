// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

vi.hoisted(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
import { Render } from '@page-editor/core';
import { editorConfig } from '../editor/config.jsx';
import { PageContext } from '../editor/context.js';
import { VideoPlayer, isPlayableVideo } from '../editor/components.jsx';
import { EDITABLE_TEMPLATES } from '../editor/designs.js';

const VIDEO = 'https://x.supabase.co/storage/v1/object/public/uploads/u/clip.mp4';
const ctx = (page, extra = {}) => ({ page, tokens: {}, handlers: {}, preview: false, ...extra });
const html = (props, page, extra) => renderToString(<PageContext.Provider value={ctx(page, extra)}><VideoPlayer {...props} /></PageContext.Provider>);
const attr = (out, name) => (out.match(new RegExp(`${name}="([^"]*)"`)) || [])[1];

describe('the video slot', () => {
  it('no video: shows the design picture with a play button and "Your video goes here" in the editor', () => {
    const out = html({ poster: '/landing-art/pc-plumbing/poster.webp' }, { video_url: '' }, { preview: true });
    expect(out).toContain('pk-video--mock'); expect(out).toContain('pk-video-play'); expect(out).toContain('Your video goes here');
    expect(attr(out, 'poster')).toBe('/landing-art/pc-plumbing/poster.webp');
    expect(out).not.toMatch(/\scontrols/);
  });
  it('no video and no picture: a neutral mock with the play button, label only in the editor', () => {
    const edit = html({}, { video_url: '' }, { preview: true }); const live = html({}, { video_url: '' }, { preview: false });
    expect(edit).toContain('pk-video-play'); expect(edit).toContain('Your video goes here');
    expect(live).toContain('pk-video-play'); expect(live).not.toContain('Your video goes here');
  });
  it('with a video: poster + play button + native controls', () => {
    const out = html({ poster: '/landing-art/x/p.webp' }, { video_url: VIDEO, poster_url: 'https://x.supabase.co/storage/v1/object/public/uploads/u/p.jpg' });
    expect(out).toContain('pk-video-play'); expect(out).toMatch(/\scontrols/); expect(out).not.toContain('pk-video--mock');
    expect(attr(out, 'src')).toBe(VIDEO);
    expect(attr(out, 'poster')).toBe('https://x.supabase.co/storage/v1/object/public/uploads/u/p.jpg'); // the page's own poster beats the design's
  });
  it('slot picture beats the page poster, slot video beats the page video', () => {
    const img = 'https://cdn.test/personal.png'; const vid = 'https://cdn.test/mine.mp4';
    const out = html({ poster: '/landing-art/x/p.webp', slotImage: img, slotVideo: vid }, { video_url: VIDEO, poster_url: 'https://cdn.test/page.jpg' });
    expect(attr(out, 'poster')).toBe(img); expect(attr(out, 'src')).toBe(vid);
  });
  it('only a picture (slot picture, or an image-only page): a still with no play button and no video source', () => {
    const a = html({ slotImage: 'https://cdn.test/personal.png' }, { video_url: '' });
    expect(a).toContain('pk-video--still'); expect(a).not.toContain('pk-video-play'); expect(a).not.toMatch(/\ssrc=/);
    const b = html({}, { video_url: 'https://cdn.test/hero.png?x=1' });
    expect(b).toContain('pk-video--still'); expect(b).not.toContain('pk-video-play'); expect(attr(b, 'poster')).toBe('https://cdn.test/hero.png?x=1');
  });
  it('bakedPlay: no second button over the design picture, but one over the user\'s own picture', () => {
    expect(html({ poster: '/landing-art/pc-vet/poster.webp', bakedPlay: 'yes' }, { video_url: '' })).not.toContain('pk-video-play');
    expect(html({ poster: '/landing-art/pc-vet/poster.webp', bakedPlay: 'yes' }, { video_url: VIDEO })).not.toContain('pk-video-play');
    expect(html({ poster: '/landing-art/pc-vet/poster.webp', bakedPlay: 'yes', slotImage: 'https://cdn.test/me.png' }, { video_url: VIDEO })).toContain('pk-video-play');
    expect(html({ poster: '/landing-art/pc-vet/poster.webp', bakedPlay: 'yes' }, { video_url: VIDEO, poster_url: 'https://cdn.test/page.jpg' })).toContain('pk-video-play');
  });
  it('ignores unsafe or non-https media', () => {
    const out = html({ slotImage: 'javascript:alert(1)', slotVideo: 'http://cdn.test/a.mp4' }, { video_url: VIDEO });
    expect(attr(out, 'src')).toBe(VIDEO); expect(out).not.toContain('javascript:'); expect(out).not.toContain('http://cdn.test');
    expect(isPlayableVideo('https://cdn.test/a.png')).toBe(false); expect(isPlayableVideo('https://cdn.test/a.mp4')).toBe(true); expect(isPlayableVideo('https://cdn.test/a')).toBe(true);
  });
});

describe('the play button works', () => {
  it('clicking it plays the video, hides the button and records the play once', async () => {
    const play = vi.fn(function play() { this.dispatchEvent(new Event('play')); return Promise.resolve(); });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
    const onPlay = vi.fn();
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<PageContext.Provider value={ctx({ video_url: VIDEO }, { handlers: { onPlay } })}><VideoPlayer poster="/landing-art/x/p.webp" /></PageContext.Provider>); });
    const btn = host.querySelector('.pk-video-play'); expect(btn).not.toBeNull();
    await act(async () => { btn.click(); });
    expect(play).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.pk-video-play')).toBeNull();
    expect(onPlay).toHaveBeenCalledTimes(1);
    await act(async () => { root.unmount(); });
  });
});

describe('every design shows a video slot people can recognise', () => {
  const page = { id: 'a', title: 'T', video_url: '', poster_url: null };
  EDITABLE_TEMPLATES.forEach((t) => {
    it(`${t.id}: each video card has a play button (or its picture draws one)`, () => {
      const out = renderToString(<PageContext.Provider value={ctx(page, { preview: true })}><Render config={editorConfig} data={t.editorData} /></PageContext.Provider>);
      const cards = (out.match(/class="pk-video[ "]/g) || []).length;
      const buttons = (out.match(/class="pk-video-play"/g) || []).length;
      const baked = JSON.stringify(t.editorData).includes('"bakedPlay": "yes"') || JSON.stringify(t.editorData).includes('"bakedPlay":"yes"');
      if (cards) expect(baked ? true : buttons >= cards).toBe(true);
    });
  });
});

import { ViewerContext } from '../editor/context.js';
describe('viewer extras: trim, subtitles, start frame, overlay, a button at a moment', () => {
  const withViewer = (viewer, props = {}, extra = {}) => renderToString(
    <PageContext.Provider value={ctx({ video_url: VIDEO }, extra)}><ViewerContext.Provider value={viewer}><VideoPlayer {...props} /></ViewerContext.Provider></PageContext.Provider>,
  );
  it('start and stop times become a media fragment on the video', () => {
    expect(attr(withViewer({ start: 5, end: 20 }), 'src')).toBe(`${VIDEO}#t=5,20`);
    expect(attr(withViewer({ start: 0, end: 0 }), 'src')).toBe(VIDEO);
    expect(attr(withViewer({ start: 30, end: 10 }), 'src')).toBe(`${VIDEO}#t=30`);   // a stop before the start is ignored
  });
  it('shows the chosen frame as the picture only when no picture is set', () => {
    expect(attr(withViewer({ posterAt: 7 }), 'src')).toBe(`${VIDEO}#t=7`);
    expect(attr(withViewer({ posterAt: 7 }, { poster: '/landing-art/x/p.webp' }), 'src')).toBe(VIDEO);
  });
  it('subtitles render no track on the server (they load in the browser)', () => {
    expect(withViewer({ subtitles: 'https://cdn.test/subs.vtt' })).not.toContain('<track');
  });
  it('text on the video fills {{tokens}}', () => {
    const out = renderToString(<PageContext.Provider value={ctx({ video_url: VIDEO }, { tokens: { firstname: 'Ann' } })}><ViewerContext.Provider value={{ overlay: 'Hi {{firstname|there}}, this is for you' }}><VideoPlayer /></ViewerContext.Provider></PageContext.Provider>);
    expect(out).toContain('pk-video-overlay'); expect(out).toContain('Hi Ann, this is for you');
  });
  it('the video button shows in the editor, but on a live page only after its moment', () => {
    const viewer = { ctaAt: 8, ctaLabel: 'Book a call', ctaUrl: 'https://cal.test/me' };
    const edit = withViewer(viewer, {}, { preview: true }); const live = withViewer(viewer, {}, { preview: false });
    expect(edit).toContain('pk-video-cta'); expect(edit).toContain('Book a call'); expect(edit).toContain('https://cal.test/me');
    expect(live).not.toContain('pk-video-cta');
    expect(withViewer({ ctaAt: 0, ctaLabel: 'x', ctaUrl: 'https://a.test' }, {}, { preview: true })).not.toContain('pk-video-cta');   // 0 = off
    expect(withViewer({ ctaAt: 5, ctaLabel: 'x', ctaUrl: 'javascript:alert(1)' }, {}, { preview: true })).not.toContain('pk-video-cta');
  });
  it('every design with a video offers all of these fields', () => {
    const withVideo = Object.entries(editorConfig.components).filter(([, c]) => c.fields?.slotImage);
    expect(withVideo.length).toBeGreaterThan(5);
    for (const [name, c] of withVideo) for (const k of ['viewerStart', 'viewerEnd', 'viewerPosterAt', 'viewerSubtitles', 'viewerOverlay', 'viewerCtaAt', 'viewerCtaLabel', 'viewerCtaUrl']) expect([name, k, !!c.fields[k]]).toEqual([name, k, true]);
  });
});

describe('viewer extras at play time', () => {
  const mountLive = (viewer, handlers = {}) => {
    const host = document.createElement('div'); document.body.appendChild(host);
    act(() => { createRoot(host).render(<PageContext.Provider value={{ page: { video_url: VIDEO }, tokens: {}, handlers, preview: false }}><ViewerContext.Provider value={viewer}><VideoPlayer /></ViewerContext.Provider></PageContext.Provider>); });
    const v = host.querySelector('video');
    v.pause = vi.fn(); v.play = vi.fn(() => Promise.resolve());
    act(() => { v.dispatchEvent(new Event('play')); });   // the visitor pressed play
    return { host, v };
  };
  const at = (v, t) => { Object.defineProperty(v, 'currentTime', { value: t, writable: true, configurable: true }); Object.defineProperty(v, 'duration', { value: 60, configurable: true }); act(() => { v.dispatchEvent(new Event('timeupdate')); }); };
  it('the button appears when the video reaches its moment', () => {
    const { host, v } = mountLive({ ctaAt: 10, ctaLabel: 'Book a call', ctaUrl: 'https://cal.test/me' });
    at(v, 4); expect(host.querySelector('.pk-video-cta')).toBeNull();
    at(v, 10.5); expect(host.querySelector('.pk-video-cta')?.textContent).toBe('Book a call');
  });
  it('the video stops at its stop time and counts as finished', () => {
    const onComplete = vi.fn();
    const { v } = mountLive({ start: 2, end: 12 }, { onComplete });
    at(v, 12.2);
    expect(v.pause).toHaveBeenCalled(); expect(onComplete).toHaveBeenCalledTimes(1);
  });
  it('with "play again" it restarts from the start time instead', () => {
    const { v } = mountLive({ start: 2, end: 12, loop: 'yes' });
    at(v, 12.2);
    expect(v.currentTime).toBe(2); expect(v.play).toHaveBeenCalled();
  });
});

describe('playing again, and the start frame', () => {
  const mountLive2 = (viewer) => {
    const host = document.createElement('div'); document.body.appendChild(host);
    act(() => { createRoot(host).render(<PageContext.Provider value={{ page: { video_url: VIDEO }, tokens: {}, handlers: {}, preview: false }}><ViewerContext.Provider value={viewer}><VideoPlayer /></ViewerContext.Provider></PageContext.Provider>); });
    const v = host.querySelector('video'); v.pause = vi.fn(); v.play = vi.fn(() => Promise.resolve());
    return v;
  };
  const set = (v, t) => { Object.defineProperty(v, 'currentTime', { value: t, writable: true, configurable: true }); };
  it('after the stop time, pressing play starts again from the start time', () => {
    const v = mountLive2({ start: 2, end: 12 });
    set(v, 12.1); act(() => { v.dispatchEvent(new Event('play')); });
    expect(v.currentTime).toBe(2);
  });
  it('pause and resume inside the range keeps the position', () => {
    const v = mountLive2({ start: 2, end: 12 });
    set(v, 5); act(() => { v.dispatchEvent(new Event('play')); });   // first play from a position in range
    set(v, 8); act(() => { v.dispatchEvent(new Event('play')); });
    expect(v.currentTime).toBe(8);
  });
  it('a chosen start frame does not skip the intro: play starts at the start time, even 0', () => {
    const v = mountLive2({ posterAt: 30, start: 0 });
    set(v, 30); act(() => { v.dispatchEvent(new Event('play')); });
    expect(v.currentTime).toBe(0);
  });
});

describe('looping with a start time', () => {
  it('each round starts at the start time, also when no stop time is set', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    act(() => { createRoot(host).render(<PageContext.Provider value={{ page: { video_url: VIDEO }, tokens: {}, handlers: {}, preview: false }}><ViewerContext.Provider value={{ start: 4, loop: 'yes' }}><VideoPlayer /></ViewerContext.Provider></PageContext.Provider>); });
    const v = host.querySelector('video'); v.play = vi.fn(() => Promise.resolve());
    expect(v.loop).toBe(false);   // not the native loop, which would restart at 0
    Object.defineProperty(v, 'currentTime', { value: 60, writable: true, configurable: true });
    act(() => { v.dispatchEvent(new Event('ended')); });
    expect(v.currentTime).toBe(4); expect(v.play).toHaveBeenCalled();
  });
  it('without a start time the native loop is used', () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    act(() => { createRoot(host).render(<PageContext.Provider value={{ page: { video_url: VIDEO }, tokens: {}, handlers: {}, preview: false }}><ViewerContext.Provider value={{ loop: 'yes' }}><VideoPlayer /></ViewerContext.Provider></PageContext.Provider>); });
    expect(host.querySelector('video').loop).toBe(true);
  });
});

describe('watch progress over the trimmed part', () => {
  const run = (viewer, times, duration = 120, opts = {}) => {
    const marks = [];
    const host = document.createElement('div'); document.body.appendChild(host);
    act(() => { createRoot(host).render(<PageContext.Provider value={{ page: { video_url: VIDEO }, tokens: {}, handlers: { onProgress: (k) => marks.push(k) }, preview: false }}><ViewerContext.Provider value={viewer}><VideoPlayer /></ViewerContext.Provider></PageContext.Provider>); });
    const v = host.querySelector('video'); v.pause = vi.fn(); v.play = vi.fn(() => Promise.resolve());
    Object.defineProperty(v, 'duration', { value: duration, configurable: true });
    if (!opts.beforePlay) act(() => { v.dispatchEvent(new Event('play')); });
    for (const t of times) { Object.defineProperty(v, 'currentTime', { value: t, writable: true, configurable: true }); act(() => { v.dispatchEvent(new Event('timeupdate')); }); }
    return marks;
  };
  it('playing seconds 90-100 of 120 does not record every milestone at once', () => {
    expect(run({ start: 90, end: 100 }, [90.5])).toEqual([]);
    expect(run({ start: 90, end: 100 }, [92.6, 95.1, 97.6])).toEqual(['progress_25', 'progress_50', 'progress_75']);
  });
  it('playing seconds 0-20 reaches the milestones, including at the stop', () => {
    expect(run({ start: 0, end: 20 }, [5.1, 10.1, 15.1, 20])).toEqual(['progress_25', 'progress_50', 'progress_75']);
  });
  it('untrimmed video keeps counting over the whole video', () => {
    expect(run({}, [31, 61, 91])).toEqual(['progress_25', 'progress_50', 'progress_75']);
  });
  it('a start-frame seek before play is not watching', () => {
    expect(run({ posterAt: 100 }, [100], 120, { beforePlay: true })).toEqual([]);
  });
  it('a stop time past the real end counts to the real end', () => {
    expect(run({ end: 120 }, [15.1, 30.1, 45.1], 60)).toEqual(['progress_25', 'progress_50', 'progress_75']);
  });
});

const withViewerHtml = (viewer, props = {}, extra = {}) => renderToString(<PageContext.Provider value={ctx({ video_url: VIDEO }, extra)}><ViewerContext.Provider value={viewer}><VideoPlayer {...props} /></ViewerContext.Provider></PageContext.Provider>);
describe('viewer extras: hosts without CORS, a start-frame range, replays, button clicks', () => {
  const live = (viewer, handlers = {}) => {
    const host = document.createElement('div'); document.body.appendChild(host);
    act(() => { createRoot(host).render(<PageContext.Provider value={{ page: { video_url: VIDEO }, tokens: {}, handlers, preview: false }}><ViewerContext.Provider value={viewer}><VideoPlayer /></ViewerContext.Provider></PageContext.Provider>); });
    const v = host.querySelector('video'); v.pause = vi.fn(); v.play = vi.fn(() => Promise.resolve());
    return { host, v };
  };
  const set = (v, t) => { Object.defineProperty(v, 'currentTime', { value: t, writable: true, configurable: true }); };
  it('subtitles are fetched with CORS and played from a same-origin copy; the video is never put in CORS mode', async () => {
    const created = []; const revoked = [];
    globalThis.URL.createObjectURL = vi.fn((b) => { const u = `blob:subs-${created.length}`; created.push(b); return u; });
    globalThis.URL.revokeObjectURL = vi.fn((u) => { revoked.push(u); });
    const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['WEBVTT\n\n'], { type: 'text/vtt' }) }));
    vi.stubGlobal('fetch', fetchMock);
    const host = document.createElement('div'); document.body.appendChild(host);
    let root;
    await act(async () => { root = createRoot(host); root.render(<PageContext.Provider value={ctx({ video_url: VIDEO })}><ViewerContext.Provider value={{ subtitles: 'https://cdn.test/subs.vtt' }}><VideoPlayer /></ViewerContext.Provider></PageContext.Provider>); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(fetchMock).toHaveBeenCalledWith('https://cdn.test/subs.vtt', { mode: 'cors' });
    expect(host.querySelector('video').hasAttribute('crossorigin')).toBe(false);
    expect(host.querySelector('track')?.getAttribute('src')).toBe('blob:subs-0');
    expect(host.querySelector('track')?.hasAttribute('default')).toBe(true);
    act(() => { root.unmount(); });
    expect(revoked).toContain('blob:subs-0');
    vi.unstubAllGlobals();
  });
  it('only an https link is fetched; a failed fetch leaves the video without a track', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('blocked'); });
    vi.stubGlobal('fetch', fetchMock);
    const mountSubs = async (link) => {
      const host = document.createElement('div'); document.body.appendChild(host);
      await act(async () => { createRoot(host).render(<PageContext.Provider value={ctx({ video_url: VIDEO })}><ViewerContext.Provider value={{ subtitles: link }}><VideoPlayer /></ViewerContext.Provider></PageContext.Provider>); });
      await act(async () => { await Promise.resolve(); });
      return host;
    };
    expect((await mountSubs('http://cdn.test/s.vtt')).querySelector('track')).toBeNull();
    expect((await mountSubs('javascript:alert(1)')).querySelector('track')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await mountSubs('https://cdn.test/s.vtt')).querySelector('track')).toBeNull();   // the fetch failed
    expect((await mountSubs('https://cdn.test/s.vtt')).querySelector('video')).not.toBeNull(); // and the video still plays
    vi.unstubAllGlobals();
  });
  it('a start frame with a stop time makes a valid start-only fragment', () => {
    expect(attr(withViewerHtml({ posterAt: 30, start: 2, end: 12 }), 'src')).toBe(`${VIDEO}#t=30`);
  });
  it('replaying after the video ended starts at the start time, also with no stop time; a seek before the start is undone', () => {
    const { v } = live({ start: 10 });
    set(v, 12); act(() => { v.dispatchEvent(new Event('play')); });   // first play inside the range
    set(v, 0); act(() => { v.dispatchEvent(new Event('play')); });    // native replay seeks to 0 first
    expect(v.currentTime).toBe(10);
  });
  it('clicking the button on the video is recorded as a button click on a live page', () => {
    const onCta = vi.fn();
    const { host, v } = live({ ctaAt: 3, ctaLabel: 'Book', ctaUrl: 'https://cal.test/me' }, { onCta });
    act(() => { v.dispatchEvent(new Event('play')); });
    set(v, 4); Object.defineProperty(v, 'duration', { value: 60, configurable: true }); act(() => { v.dispatchEvent(new Event('timeupdate')); });
    act(() => { host.querySelector('.pk-video-cta').click(); });
    expect(onCta).toHaveBeenCalledTimes(1);
  });
});

import { fillPropTokens } from '../editor/tokenFields.jsx';
describe('button text keeps its tokens as words', () => {
  it('a token value with spaces and punctuation is not percent-encoded in a button label or description', () => {
    const tokens = { company: 'Acme & Sons' };
    const out = fillPropTokens({ viewerCtaLabel: 'Talk to {{company}}', ctaLabel: 'Book {{company}}', logoAlt: 'Logo of {{company}}', viewerCtaUrl: 'https://x.test/?c={{company}}' }, tokens);
    expect(out.viewerCtaLabel).toBe('Talk to {{company}}'); expect(out.ctaLabel).toBe('Book {{company}}'); expect(out.logoAlt).toBe('Logo of {{company}}');
    expect(out.viewerCtaUrl).toContain('Acme%20%26%20Sons');   // links are still encoded
  });
});
