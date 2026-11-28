// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openShareModal } from '../ShareModal.js';

const link = 'https://smartvid.app/p/abc?c=c1&firstName=Mike';
const $ = (s) => document.querySelector(s);

describe('share window (Link, GIF, Embed)', () => {
  let writes; let html;
  beforeEach(() => {
    document.body.innerHTML = '';
    writes = []; html = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: vi.fn(async (t) => { writes.push(t); }),
      write: vi.fn(async (items) => { html.push(await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsText(items[0].parts['text/html']); })); }),
    } });
    globalThis.ClipboardItem = class { constructor(parts) { this.parts = parts; } };
  });

  it('Link: copy their personal link', async () => {
    openShareModal({ name: 'Mike', link, thumbnailUrl: 'https://cdn.x/mike.gif' });
    expect($('[data-share-link]').value).toBe(link);
    $('[data-share-copy-link]').click();
    await Promise.resolve();
    expect(writes).toEqual([link]);
  });

  it('GIF: preview, Copy GIF (clickable thumbnail), Download GIF and the Outlook still', async () => {
    const download = vi.fn();
    openShareModal({ name: 'Mike', link, thumbnailUrl: 'https://cdn.x/mike.gif', stillUrl: 'https://cdn.x/mike.jpg', actions: { download } });
    $('[data-share-tab="gif"]').click();
    expect($('[data-share-preview]').src).toBe('https://cdn.x/mike.gif');
    $('[data-share-copy-gif]').click();
    await new Promise((r) => setTimeout(r, 20));
    expect(html[0]).toContain('<a href="https://smartvid.app/p/abc?c=c1&amp;firstName=Mike"><img src="https://cdn.x/mike.gif"');
    $('[data-share-download]').click();
    $('[data-share-download-still]').click();
    expect(download.mock.calls.map((c) => c[0])).toEqual(['main', 'still']);
  });

  it('Embed: an HTML5 video with the GIF as poster and fallback; Escape closes', async () => {
    const onClose = vi.fn();
    openShareModal({ name: 'Mike', link, thumbnailUrl: 'https://cdn.x/mike.gif', videoUrl: 'https://cdn.x/v.mp4', tab: 'embed', onClose });
    const code = $('[data-share-embed-code]').value;
    expect(code).toContain('<video src="https://cdn.x/v.mp4" poster="https://cdn.x/mike.gif"');
    expect(code).toContain('<img src="https://cdn.x/mike.gif"');
    $('[data-share-copy-embed]').click();
    await Promise.resolve();
    expect(writes[0]).toBe(code);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect($('[data-share-modal]')).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('without a thumbnail the GIF tab says how to make one', () => {
    openShareModal({ link, tab: 'gif' });
    expect(document.body.textContent).toContain('No thumbnail yet');
  });

  describe('Share button and QR code', () => {
    const setShare = (v) => Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: v });
    const flush = () => new Promise((r) => setTimeout(r, 30));

    it('Share is hidden without navigator.share', () => {
      setShare(undefined);
      openShareModal({ name: 'Mike', link });
      expect($('[data-share-native]')).toBeNull();
    });

    it('Share calls navigator.share with the link', async () => {
      const share = vi.fn(async () => {}); setShare(share);
      openShareModal({ name: 'Mike', link });
      $('[data-share-native]').click();
      await flush();
      expect(share).toHaveBeenCalledTimes(1);
      expect(share.mock.calls[0][0].url).toBe(link);
      expect(writes).toEqual([]);
    });

    it('closing the share sheet (AbortError) does nothing; other errors copy the link', async () => {
      setShare(vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); }));
      openShareModal({ name: 'Mike', link });
      $('[data-share-native]').click();
      await flush();
      expect(writes).toEqual([]);
      expect($('[data-share-note]').textContent).toBe('');
      setShare(vi.fn(async () => { throw new Error('boom'); }));
      document.body.innerHTML = '';
      openShareModal({ name: 'Mike', link });
      $('[data-share-native]').click();
      await flush();
      expect(writes).toEqual([link]);
      expect($('[data-share-note]').textContent).toContain('copied');
    });

    it('counts a prospect as sent only after the share sheet worked, never when it was closed', async () => {
      const sent = vi.fn();
      // closed the sheet: not sent
      setShare(vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); }));
      openShareModal({ name: 'Mike', link, actions: { sent } });
      $('[data-share-native]').click();
      await flush();
      expect(sent).not.toHaveBeenCalled();
      // shared: sent
      setShare(vi.fn(async () => {}));
      document.body.innerHTML = '';
      openShareModal({ name: 'Mike', link, actions: { sent } });
      $('[data-share-native]').click();
      await flush();
      expect(sent).toHaveBeenCalledTimes(1);
      // sharing failed but the link was copied instead: sent
      setShare(vi.fn(async () => { throw new Error('boom'); }));
      document.body.innerHTML = '';
      openShareModal({ name: 'Mike', link, actions: { sent } });
      $('[data-share-native]').click();
      await flush();
      expect(sent).toHaveBeenCalledTimes(2);
    });

    it('QR: note for http links, SVG preview and downloads for https', async () => {
      setShare(undefined);
      openShareModal({ name: 'Mike', link: 'http://example.com/p/abc' });
      await flush();
      expect($('[data-share-qr]').textContent).toContain('A QR code needs a secure (https) link.');
      expect($('[data-share-qr-svg]')).toBeNull();
      document.body.innerHTML = '';
      openShareModal({ name: 'Mike', link });
      await flush();
      expect($('[data-share-qr-svg] svg')).not.toBeNull();
      expect($('[data-share-qr-png]').textContent).toBe('Download PNG');
      expect($('[data-share-qr-svg-download]').textContent).toBe('Download SVG');
    });
  });
});
