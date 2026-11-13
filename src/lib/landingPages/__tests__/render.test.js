import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderLandingPage } from '../render.js';
import { defaultConfig } from '../templates.js';
import { mountVideoPage } from '../../../pages/VideoPage.jsx';

const VIDEO = 'https://x.supabase.co/storage/v1/object/public/uploads/u/clip.mp4';
const page = (config, extra = {}) => ({ id: 'abc12345', title: 'Launch', video_url: VIDEO, poster_url: 'https://x/p.jpg', config, ...extra });

describe('renderLandingPage', () => {
  it('fills tokens and falls back when missing', () => {
    const cfg = defaultConfig('personal');
    const withName = renderLandingPage({ page: page(cfg), tokens: { firstname: 'Ann', company: 'Acme' } });
    expect(withName.root.querySelector('.vp-headline').textContent).toBe('Hi Ann, I made this for you');
    expect(withName.root.querySelector('.vp-subhead').textContent).toContain('Acme');
    const anon = renderLandingPage({ page: page(cfg), tokens: {} });
    expect(anon.root.querySelector('.vp-headline').textContent).toBe('Hi there, I made this for you');
    expect(anon.root.textContent).not.toContain('{{');
  });

  it('never turns config or token text into markup', () => {
    const cfg = { ...defaultConfig('clean'), headline: '<img src=x onerror=alert(1)>{{firstname}}', subhead: '<script>alert(1)</script>' };
    const v = renderLandingPage({ page: page(cfg, { title: '<b>x</b>' }), tokens: { firstname: '<svg onload=alert(1)>' } });
    expect(v.root.querySelector('img.vp-logo')).toBeNull();
    expect(v.root.querySelector('script')).toBeNull();
    expect(v.root.querySelector('svg')).toBeNull();
    expect(v.root.querySelector('.vp-headline').textContent).toContain('<img src=x');
  });

  it('only renders safe CTA links and https media', () => {
    const bad = renderLandingPage({ page: page({ ...defaultConfig('clean'), cta: { label: 'Go', url: 'javascript:alert(1)' } }) });
    expect(bad.root.querySelector('.vp-cta')).toBeNull();
    const ok = renderLandingPage({ page: page({ ...defaultConfig('clean'), cta: { label: 'Go', url: 'https://example.com/buy' } }) });
    const a = ok.root.querySelector('.vp-cta');
    expect(a.getAttribute('href')).toBe('https://example.com/buy');
    expect(a.rel).toContain('noopener');
    const http = renderLandingPage({ page: page(defaultConfig('clean'), { video_url: 'http://insecure/x.mp4' }) });
    expect(http.video.getAttribute('src')).toBeNull();
  });

  it('exposes the lead form and posts values through onLead', async () => {
    const onLead = vi.fn(async () => ({ stored: true, error: null }));
    const v = renderLandingPage({ page: page(defaultConfig('sales')), handlers: { onLead } });
    const form = v.root.querySelector('form');
    form.querySelector('[name=name]').value = 'Ann';
    form.querySelector('[name=email]').value = 'ann@example.com';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(onLead).toHaveBeenCalledWith({ name: 'Ann', email: 'ann@example.com' }));
    await vi.waitFor(() => expect(v.root.querySelector('.vp-thanks')).not.toBeNull());
  });

  it('keeps the form and shows an error when submit fails', async () => {
    const v = renderLandingPage({ page: page(defaultConfig('sales')), handlers: { onLead: async () => ({ stored: false, error: 'nope' }) } });
    const form = v.root.querySelector('form');
    form.querySelector('[name=name]').value = 'Ann';
    form.querySelector('[name=email]').value = 'a@b.co';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(v.root.querySelector('.vp-status').textContent).toMatch(/try again/i));
    expect(v.root.querySelector('.vp-submit').disabled).toBe(false);
  });

  it('records play, progress milestones once, and completion', () => {
    const events = [];
    const v = renderLandingPage({
      page: page(defaultConfig('clean')),
      handlers: { onPlay: () => events.push('play'), onProgress: (k) => events.push(k), onComplete: () => events.push('complete') },
    });
    Object.defineProperty(v.video, 'duration', { value: 100, configurable: true });
    v.video.dispatchEvent(new Event('play'));
    v.video.dispatchEvent(new Event('play'));
    [10, 30, 55, 80, 80].forEach((t) => { v.video.currentTime = t; v.video.dispatchEvent(new Event('timeupdate')); });
    v.video.dispatchEvent(new Event('ended'));
    expect(events).toEqual(['play', 'progress_25', 'progress_50', 'progress_75', 'complete']);
  });

  it('sends no events in preview mode', () => {
    const onPlay = vi.fn();
    const v = renderLandingPage({ page: page(defaultConfig('clean')), preview: true, handlers: { onPlay } });
    v.video.dispatchEvent(new Event('play'));
    expect(onPlay).not.toHaveBeenCalled();
  });
});

describe('mountVideoPage', () => {
  beforeEach(() => { document.documentElement.className = ''; window.history.replaceState(null, '', '/p/abc12345'); });

  it('shows not found for a missing page and unavailable on errors', async () => {
    const a = document.createElement('div');
    expect(await mountVideoPage(a, 'abc12345', { fetchPage: async () => null })).toBeNull();
    expect(a.textContent).toContain('Page not found');
    const b = document.createElement('div');
    await mountVideoPage(b, 'abc12345', { fetchPage: async () => { throw new Error('boom'); } });
    expect(b.textContent).toContain('Page unavailable');
  });

  it('personalizes from the contact, lets the contact win over the URL, and tracks the view', async () => {
    window.history.replaceState(null, '', '/p/abc12345?c=contact_01&firstname=Mallory&company=Initech');
    const cfg = { ...defaultConfig('clean'), headline: 'Hi {{firstname}} at {{company}}' };
    const track = vi.fn();
    const root = document.createElement('div');
    await mountVideoPage(root, 'abc12345', {
      fetchPage: async () => page(cfg),
      fetchTokens: async (id, c) => (c === 'contact_01' ? { firstname: 'Ann' } : {}),
      recordEvent: track,
    });
    expect(root.querySelector('.vp-headline').textContent).toBe('Hi Ann at Initech');
    expect(track).toHaveBeenCalledWith('abc12345', { kind: 'view', contactId: 'contact_01' });
  });

  it('ignores an invalid contact id and never looks it up', async () => {
    window.history.replaceState(null, '', '/p/abc12345?c=bad%20id!');
    const fetchTokens = vi.fn(async () => ({}));
    const track = vi.fn();
    await mountVideoPage(document.createElement('div'), 'abc12345', { fetchPage: async () => page(defaultConfig('clean')), fetchTokens, recordEvent: track });
    expect(fetchTokens).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('abc12345', { kind: 'view', contactId: null });
  });

  it('marks embed mode and stores a lead with the contact', async () => {
    window.history.replaceState(null, '', '/p/abc12345?embed=1&c=contact_01');
    const submitLead = vi.fn(async () => ({ stored: true, error: null }));
    const track = vi.fn();
    const root = document.createElement('div');
    await mountVideoPage(root, 'abc12345', { fetchPage: async () => page(defaultConfig('sales')), fetchTokens: async () => ({}), recordEvent: track, submitLead });
    expect(document.documentElement.classList.contains('vp-embed')).toBe(true);
    const form = root.querySelector('form');
    form.querySelector('[name=name]').value = 'Ann';
    form.querySelector('[name=email]').value = 'a@b.co';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(submitLead).toHaveBeenCalledWith({ pageId: 'abc12345', contactId: 'contact_01', data: { name: 'Ann', email: 'a@b.co' } }));
    await vi.waitFor(() => expect(track).toHaveBeenCalledWith('abc12345', { kind: 'lead', contactId: 'contact_01' }));
  });
});
