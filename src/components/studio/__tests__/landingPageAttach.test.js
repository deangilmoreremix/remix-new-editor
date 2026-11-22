// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const picker = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../../../lib/landingPages/pickerModal.js', () => ({
  openLandingPagePicker: picker.open,
  toPickerVideo: (v) => (v && /^https:\/\//.test(v.url) ? v : null),
}));
import { mediaFromHref, attachTo, scan, mountLandingPageButtons } from '../landingPageAttach.js';
import { createLandingPageButton } from '../landingPageAction.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
const html = (s) => { const d = document.createElement('div'); d.innerHTML = s; document.body.appendChild(d); return d; };
const btnsIn = (root) => root.querySelectorAll('[data-action="create-landing-page"]');
beforeEach(() => { document.body.innerHTML = ''; picker.open.mockClear(); });

describe('which links get the button', () => {
  it('https images and videos by extension; nothing else', () => {
    expect(mediaFromHref('https://cdn.test/a.mp4?x=1')).toEqual({ url: 'https://cdn.test/a.mp4?x=1', type: 'video' });
    expect(mediaFromHref('https://cdn.test/a.PNG')).toMatchObject({ type: 'image' });
    for (const no of ['https://cdn.test/a.mp3', 'https://cdn.test/a.zip', 'https://cdn.test/shots.csv', 'http://cdn.test/a.png', 'blob:https://x/abc', 'data:image/png;base64,AAAA', '#', '', 'javascript:alert(1)']) expect(mediaFromHref(no), no).toBeNull();
  });
  it('a link with no extension is decided by the media shown beside it', () => {
    expect(mediaFromHref('https://cdn.test/storage/obj/123', 'video')).toMatchObject({ type: 'video' });
    expect(mediaFromHref('https://cdn.test/storage/obj/123')).toBeNull();
  });
});

describe('the button copies the studio\'s own Download style', () => {
  it('createLandingPageButton({ like }) takes its classes', () => {
    const dl = document.createElement('a'); dl.className = 'flex-1 btn-secondary-modern py-2.5 rounded-xl font-bold text-sm text-center';
    expect(createLandingPageButton({ like: dl }).className).toBe(dl.className);
    expect(createLandingPageButton({}).className).toContain('rounded-2xl');
  });

  it.each([
    ['a full-width button row (Character / Commercial)', '<div class="flex gap-2"><a href="https://cdn.test/r.png" download class="flex-1 btn-secondary-modern py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download</a></div>', 'flex-1 btn-secondary-modern py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all'],
    ['a block button (Avatar / Video Tools / Upscale)', '<a href="https://cdn.test/r.mp4" download class="block w-full btn-secondary-modern py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download</a>', 'block w-full btn-secondary-modern py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all'],
    ['a small text link (Director / AI VFX)', '<a href="https://cdn.test/r.mp4" download target="_blank" class="text-xs font-bold text-primary hover:underline">Download</a>', 'text-xs font-bold text-primary hover:underline'],
    ['a small secondary button (Animate / Photo Studio)', '<a href="https://cdn.test/r.mp4" download class="btn-secondary-modern text-xs">Download</a>', 'btn-secondary-modern text-xs'],
  ])('%s', (_name, markup, classes) => {
    const root = html(markup);
    scan(root);
    const b = btnsIn(root);
    expect(b).toHaveLength(1);
    expect(b[0].className).toBe(classes);
    expect(b[0].previousElementSibling.tagName).toBe('A');          // right after the Download link
  });
});

describe('behaviour', () => {
  it('opens the picker with that result when clicked, and does not download', async () => {
    const root = html('<a href="https://cdn.test/r.png" download class="x">Download</a>');
    scan(root, { studio: 'character' });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    btnsIn(root)[0].dispatchEvent(click);
    await flush();
    expect(click.defaultPrevented).toBe(true);
    expect(picker.open).toHaveBeenCalledWith({ video: expect.objectContaining({ url: 'https://cdn.test/r.png', type: 'image', studio: 'character' }) });
  });

  it('never twice for the same link, even when scanned again', () => {
    const root = html('<a href="https://cdn.test/r.png" download class="x">Download</a>');
    scan(root); scan(root); attachTo(root.querySelector('a'));
    expect(btnsIn(root)).toHaveLength(1);
  });

  it('skips audio, zips, plain links without download, and anything in the editor, the preview window or data-lp-skip', () => {
    const root = html(`
      <a href="https://cdn.test/s.mp3" download class="a">Audio</a>
      <a href="https://cdn.test/s.zip" download class="a">Zip</a>
      <a href="https://cdn.test/r.png" class="a">Open</a>
      <div data-landing-picker><a href="https://cdn.test/1.png" download class="a">x</a></div>
      <div class="mdv-overlay"><a href="https://cdn.test/2.png" download class="a">x</a></div>
      <div data-lp-skip><a href="https://cdn.test/3.png" download class="a">x</a></div>`);
    scan(root);
    expect(btnsIn(root)).toHaveLength(0);
  });

  it('reads the link at click time, so a re-generated result opens the new one', async () => {
    const root = html('<a href="https://cdn.test/old.png" download class="x">Download</a>');
    scan(root);
    root.querySelector('a').setAttribute('href', 'https://cdn.test/new.png');
    btnsIn(root)[0].click(); await flush();
    expect(picker.open).toHaveBeenCalledWith({ video: expect.objectContaining({ url: 'https://cdn.test/new.png' }) });
  });
});

describe('the observer', () => {
  it('adds the button when a studio renders its result, and when the href is filled in later', async () => {
    const stop = mountLandingPageButtons().stop;
    const holder = document.createElement('div'); document.body.appendChild(holder);
    holder.innerHTML = '<a download class="btn-secondary-modern">Download</a>';           // no href yet (Commercial / Edit)
    await flush();
    expect(btnsIn(holder)).toHaveLength(0);
    holder.querySelector('a').href = 'https://cdn.test/result.png';
    await flush();
    expect(btnsIn(holder)).toHaveLength(1);
    holder.innerHTML = '<a href="https://cdn.test/two.mp4" download class="btn-secondary-modern">Download</a>';   // a new result replaces the DOM
    await flush();
    expect(btnsIn(holder)).toHaveLength(1);
    stop();
  });

  it('hides the button when the link stops being a picture or video', async () => {
    const stop = mountLandingPageButtons().stop;
    const holder = document.createElement('div'); document.body.appendChild(holder);
    holder.innerHTML = '<a href="https://cdn.test/a.png" download class="x">Download</a>';
    await flush();
    holder.querySelector('a').setAttribute('href', '#');
    await flush();
    expect(btnsIn(holder)[0].hidden).toBe(true);
    stop();
  });
});
