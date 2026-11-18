// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

vi.hoisted(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
import { Render } from '@puckeditor/core';
import { puckConfig } from '../puck/config.jsx';
import { PageContext } from '../puck/context.js';
import { VideoPlayer, isPlayableVideo } from '../puck/components.jsx';
import { PUCK_TEMPLATES } from '../puck/designs.js';

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
  it('a token in the slot picture shows each contact\'s own picture, and falls back without one', () => {
    const page = { video_url: VIDEO, poster_url: 'https://cdn.test/page.jpg' };
    const own = html({ slotImage: '{{custom3}}' }, page, { tokens: { custom3: 'https://cdn.test/dana.png' } });
    expect(attr(own, 'poster')).toBe('https://cdn.test/dana.png');
    expect(attr(html({ slotImage: '{{custom3}}' }, page), 'poster')).toBe('https://cdn.test/page.jpg');
    expect(attr(html({ slotImage: '{{custom3}}' }, page, { tokens: { custom3: 'javascript:alert(1)' } }), 'poster')).toBe('https://cdn.test/page.jpg');
    expect(attr(html({ slotImage: '{{custom3}}' }, page, { tokens: { custom3: 'http://insecure.test/a.png' } }), 'poster')).toBe('https://cdn.test/page.jpg');
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
  PUCK_TEMPLATES.forEach((t) => {
    it(`${t.id}: each video card has a play button (or its picture draws one)`, () => {
      const out = renderToString(<PageContext.Provider value={ctx(page, { preview: true })}><Render config={puckConfig} data={t.puckData} /></PageContext.Provider>);
      const cards = (out.match(/class="pk-video[ "]/g) || []).length;
      const buttons = (out.match(/class="pk-video-play"/g) || []).length;
      const baked = JSON.stringify(t.puckData).includes('"bakedPlay": "yes"') || JSON.stringify(t.puckData).includes('"bakedPlay":"yes"');
      if (cards) expect(baked ? true : buttons >= cards).toBe(true);
    });
  });
});
