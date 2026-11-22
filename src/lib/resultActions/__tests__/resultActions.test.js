// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kindFromUrl, kindFromContentType, resolveKind, isNonMediaContentType, downloadLabel } from '../mediaKind.js';
import { extFromContentType, extFromUrl, sniffType, safeBase, buildFilename, mimeFromExt } from '../filenames.js';
import { downloadMedia, MESSAGES } from '../download.js';
import { stableId, canonicalSource } from '../ids.js';
import { buildMinimalProject, aspectFromSize } from '../minimalProject.js';
import { createLinkCache } from '../linkCache.js';
import { copyToStorage, COPY_LIMITS, CopyError } from '../copyToStorage.js';
import { preparePublishProject } from '../../editor/publish/publishClient.js';
import { buildViewerModel } from '../../editor/publish/interactivePlayer.js';

const bytes = (...b) => new Uint8Array([...b, ...new Array(Math.max(0, 32 - b.length)).fill(0)]);
const ftyp = (brand) => { const a = new Uint8Array(32); a.set([0, 0, 0, 0x20]); a.set([...'ftyp'].map((c) => c.charCodeAt(0)), 4); a.set([...brand].map((c) => c.charCodeAt(0)), 8); return a; };
const blobOf = (data, type = '') => new Blob([data], { type });
const resp = (data, { type = 'video/mp4', status = 200, length } = {}) => ({
  ok: status < 300, status,
  headers: { get: (h) => ({ 'content-type': type, 'content-length': length != null ? String(length) : null })[h.toLowerCase()] ?? null },
  blob: async () => blobOf(data, type),
});

describe('media kind', () => {
  it('detects kinds from addresses and content types', () => {
    expect(kindFromUrl('https://x.io/a.mp4?sig=1')).toBe('video');
    expect(kindFromUrl('https://x.io/a.WEBP')).toBe('image');
    expect(kindFromUrl('https://x.io/a.mp3')).toBe('audio');
    expect(kindFromUrl('https://x.io/file')).toBeNull();
    expect(kindFromContentType('video/mp4; codecs=avc1')).toBe('video');
    expect(kindFromContentType('application/octet-stream')).toBeNull();
    expect(resolveKind('image', 'https://x.io/a.mp4')).toBe('image');
    expect(resolveKind(undefined, 'https://x.io/a')).toBe('video');
    expect(isNonMediaContentType('text/html; charset=utf-8')).toBe(true);
    expect(isNonMediaContentType('application/json')).toBe(true);
    expect(isNonMediaContentType('video/mp4')).toBe(false);
    expect(downloadLabel('video')).toBe('Download MP4');
    expect(downloadLabel('image')).toBe('Download image');
  });
});

describe('file names and types', () => {
  it('reads extensions from content type and address', () => {
    expect(extFromContentType('image/jpeg')).toBe('jpg');
    expect(extFromContentType('video/quicktime; x=1')).toBe('mov');
    expect(extFromContentType('application/octet-stream')).toBeNull();
    expect(extFromUrl('https://x.io/a/b.JPEG?x=1#y')).toBe('jpg');
    expect(extFromUrl('https://x.io/a/b')).toBeNull();
    expect(extFromUrl('https://x.io/a/b.exe')).toBeNull();
    expect(mimeFromExt('webp')).toBe('image/webp');
  });
  it('sniffs the real type from the first bytes', () => {
    expect(sniffType(ftyp('isom'))).toEqual({ ext: 'mp4', mime: 'video/mp4' });
    expect(sniffType(ftyp('qt  '))).toEqual({ ext: 'mov', mime: 'video/quicktime' });
    expect(sniffType(ftyp('M4A '))).toEqual({ ext: 'm4a', mime: 'audio/mp4' });
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47))).toEqual({ ext: 'png', mime: 'image/png' });
    expect(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
    expect(sniffType(bytes(0x1a, 0x45, 0xdf, 0xa3))).toEqual({ ext: 'webm', mime: 'video/webm' });
    expect(sniffType(bytes(...[...'ID3'].map((c) => c.charCodeAt(0))))).toEqual({ ext: 'mp3', mime: 'audio/mpeg' });
    expect(sniffType(bytes(...[...'RIFF'].map((c) => c.charCodeAt(0)), 0, 0, 0, 0, ...[...'WEBP'].map((c) => c.charCodeAt(0))))).toEqual({ ext: 'webp', mime: 'image/webp' });
    expect(sniffType(bytes(...[...'<html>'].map((c) => c.charCodeAt(0))))).toBeNull();
    expect(sniffType(new Uint8Array(2))).toBeNull();
  });
  it('builds safe names with the real extension (never a fixed .jpg)', () => {
    expect(safeBase('My Cool Clip!! ★')).toBe('my-cool-clip');
    expect(safeBase('')).toBe('result');
    expect(safeBase('x'.repeat(200)).length).toBeLessThanOrEqual(60);
    expect(buildFilename({ base: 'Shot', kind: 'image', contentType: 'image/webp', now: 5 })).toBe('shot-5.webp');
    expect(buildFilename({ base: 'Shot', kind: 'image', contentType: 'application/octet-stream', bytes: bytes(0x89, 0x50, 0x4e, 0x47), now: 5 })).toBe('shot-5.png');
    expect(buildFilename({ base: 'Shot', kind: 'video', url: 'https://x.io/clip.webm?x', now: 5 })).toBe('shot-5.webm');
    expect(buildFilename({ base: 'Shot', kind: 'audio', now: 5 })).toBe('shot-5.mp3');
    expect(buildFilename({ base: '../../etc/passwd', kind: 'video', now: 5 })).not.toMatch(/[/\\]/);
  });
});

describe('downloadMedia', () => {
  const doc = () => { const clicks = []; const d = { createElement: () => { const a = { click: () => clicks.push({ href: a.href, download: a.download }), remove() {} }; return a; }, body: { appendChild() {} } }; return { d, clicks }; };
  const urlApi = { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() };

  it('saves the file with a real extension', async () => {
    const { d, clicks } = doc();
    const out = await downloadMedia('https://cdn.x/a', { filename: 'Clip', kind: 'video', fetchImpl: async () => resp(ftyp('isom')), doc: d, urlApi, now: 7 });
    expect(out).toMatchObject({ ok: true, method: 'blob', filename: 'clip-7.mp4' });
    expect(clicks).toEqual([{ href: 'blob:fake', download: 'clip-7.mp4' }]);
  });
  it('does not save an error page as a video, and tells the user', async () => {
    const { d, clicks } = doc();
    const status = vi.fn();
    const out = await downloadMedia('https://cdn.x/a', { fetchImpl: async () => resp('<html>Expired</html>', { type: 'text/html' }), doc: d, urlApi, onStatus: status });
    expect(out).toMatchObject({ ok: false, method: 'none', message: MESSAGES.notMedia });
    expect(clicks).toHaveLength(0);
    expect(status).toHaveBeenLastCalledWith(MESSAGES.notMedia);
  });
  it('reports an expired link for 403/404/410 without opening a tab', async () => {
    const win = { open: vi.fn() };
    for (const status of [403, 404, 410]) {
      const out = await downloadMedia('https://cdn.x/a', { fetchImpl: async () => resp('', { status }), win });
      expect(out).toMatchObject({ ok: false, message: MESSAGES.expired });
    }
    expect(win.open).not.toHaveBeenCalled();
  });
  it('opens a tab AND says so when the browser cannot read the file (CORS)', async () => {
    const win = { open: vi.fn() };
    const status = vi.fn();
    const out = await downloadMedia('https://cdn.x/a', { fetchImpl: async () => { throw new TypeError('Failed to fetch'); }, win, onStatus: status });
    expect(out).toMatchObject({ ok: true, method: 'tab', message: MESSAGES.tab });
    expect(win.open).toHaveBeenCalledWith('https://cdn.x/a', '_blank', 'noopener');
    expect(status).toHaveBeenLastCalledWith(MESSAGES.tab);
  });
  it('has no tab fallback for local blob: results and for an empty address', async () => {
    const win = { open: vi.fn() };
    expect(await downloadMedia('blob:xyz', { fetchImpl: async () => { throw new TypeError('x'); }, win })).toMatchObject({ ok: false });
    expect(win.open).not.toHaveBeenCalled();
    expect(await downloadMedia('', {})).toMatchObject({ ok: false, message: MESSAGES.noUrl });
  });
  it('never lets a throwing status callback break the download', async () => {
    const { d } = doc();
    const out = await downloadMedia('https://cdn.x/a', { fetchImpl: async () => resp(ftyp('isom')), doc: d, urlApi, onStatus: () => { throw new Error('ui'); } });
    expect(out.ok).toBe(true);
  });
});

describe('ids and cache', () => {
  it('stable ids are deterministic, url-safe and the right length', () => {
    expect(stableId('a|b')).toBe(stableId('a|b'));
    expect(stableId('a|b')).not.toBe(stableId('a|c'));
    expect(stableId('x')).toMatch(/^[a-z0-9]{20}$/);
    expect(`v${stableId('x')}`).toMatch(/^[A-Za-z0-9_-]{8,32}$/);
    expect(canonicalSource('https://x.io/a.mp4?s=1#frag')).toBe('https://x.io/a.mp4?s=1');
  });
  it('the link cache stores, merges, caps and survives broken storage', () => {
    const mem = {}; const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
    const c = createLinkCache(storage);
    c.set('a', { fileUrl: 'u1' }); c.set('a', { watchId: 'w1' });
    expect(c.get('a')).toMatchObject({ fileUrl: 'u1', watchId: 'w1' });
    for (let i = 0; i < 230; i += 1) c.set(`k${i}`, { fileUrl: `u${i}` });
    expect(Object.keys(JSON.parse(mem['resultbar.links.v1'])).length).toBeLessThanOrEqual(200);
    const broken = createLinkCache({ getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    expect(() => broken.set('a', { fileUrl: 'u' })).not.toThrow();
    expect(broken.get('a')).toBeNull();
  });
});

describe('one-clip project for /watch', () => {
  it('is accepted by preparePublishProject and plays in the public player model', () => {
    const state = buildMinimalProject({ fileUrl: 'https://x.supabase.co/storage/v1/object/public/uploads/smartvideo/u/copies/a.mp4', title: 'Spring promo', durationSec: 12.3, width: 1920, height: 1080 });
    const project = preparePublishProject(state, { title: 'Spring promo' });
    expect(project.tracks).toHaveLength(1);
    expect(project.timelineSeconds).toBe(13);
    expect(project.aspect).toBeUndefined();
    expect(JSON.stringify(project).length).toBeLessThan(5000);
    const model = buildViewerModel(project, null);
    expect(model.layers.length).toBeGreaterThan(0);
    expect(model.durationInFrames).toBeGreaterThan(0);
  });
  it('keeps a vertical frame, rejects a local address, and limits the length', () => {
    expect(aspectFromSize(1080, 1920)).toBe('9:16');
    expect(preparePublishProject(buildMinimalProject({ fileUrl: 'https://x.io/a.mp4', durationSec: 5, width: 1080, height: 1920 })).aspect).toBe('9:16');
    expect(() => buildMinimalProject({ fileUrl: 'blob:abc', durationSec: 5 })).toThrow(/web address/);
    expect(buildMinimalProject({ fileUrl: 'https://x.io/a.mp4', durationSec: 99999 }).timelineSeconds).toBe(3600);
    expect(buildMinimalProject({ fileUrl: 'https://x.io/a.mp4' }).timelineSeconds).toBe(10);
  });
});

describe('copyToStorage', () => {
  const upload = vi.fn(async (path) => ({ url: `https://s.co/storage/v1/object/public/uploads/${path}`, existed: false }));
  beforeEach(() => upload.mockClear());

  it('copies a provider file into the owner folder with a stable name and the real type', async () => {
    const out = await copyToStorage('https://cdn.muapi.test/out/abc', { kind: 'video', ownerKey: 'user_1', fetchImpl: async () => resp(ftyp('isom'), { type: 'application/octet-stream' }), upload });
    expect(upload).toHaveBeenCalledTimes(1);
    const [path, file] = upload.mock.calls[0];
    expect(path).toMatch(/^smartvideo\/user_1\/copies\/[a-z0-9]{20}\.mp4$/);
    expect(file.type).toBe('video/mp4');
    expect(out).toMatchObject({ kind: 'video', ext: 'mp4', reused: false });
    expect(out.fileUrl).toContain('/storage/v1/object/public/uploads/smartvideo/user_1/copies/');
    await copyToStorage('https://cdn.muapi.test/out/abc#frag', { kind: 'video', ownerKey: 'user_1', fetchImpl: async () => resp(ftyp('isom')), upload });
    expect(upload.mock.calls[1][0]).toBe(path);
  });
  it('does not copy what is already in our storage', async () => {
    const mine = 'https://x.supabase.co/storage/v1/object/public/uploads/smartvideo/u/a.mp4';
    const fetchImpl = vi.fn();
    expect(await copyToStorage(mine, { fetchImpl, upload })).toMatchObject({ fileUrl: mine, reused: true });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
  it('maps the failures a user can hit to clear errors', async () => {
    const run = (fetchImpl, o = {}) => copyToStorage('https://cdn.x/a', { kind: 'video', ownerKey: 'u', fetchImpl, upload, ...o }).catch((e) => e);
    expect(await run(async () => resp('', { status: 410 }))).toMatchObject({ code: 'expired' });
    expect(await run(async () => { throw new TypeError('Failed to fetch'); })).toMatchObject({ code: 'blocked' });
    expect(await run(async () => resp('<html>', { type: 'text/html' }))).toMatchObject({ code: 'not_media' });
    expect(await run(async () => resp(ftyp('isom'), { length: COPY_LIMITS.video + 1 }))).toMatchObject({ code: 'too_large' });
    expect(await run(async () => resp(bytes(1, 2, 3, 4, 5, 6, 7, 8), { type: 'application/octet-stream' }))).toMatchObject({ code: 'bad_type' });
    expect(await run(async () => resp(ftyp('isom')), { upload: async () => { throw Object.assign(new Error('nope'), { code: 'upload_failed' }); } })).toMatchObject({ code: 'upload_failed' });
    expect(await run(async () => resp(ftyp('isom')), { upload: async () => { throw Object.assign(new Error('slow'), { code: 'timeout' }); } })).toMatchObject({ code: 'timeout' });
    expect(new CopyError('x', 'y').code).toBe('x');
    expect(upload).not.toHaveBeenCalled();
  });
  it('enforces the size cap on the real bytes even when no length is declared', async () => {
    const big = { ok: true, status: 200, headers: { get: (h) => (h === 'content-type' ? 'image/png' : null) }, blob: async () => ({ size: COPY_LIMITS.image + 1, slice: () => blobOf(bytes(0x89, 0x50, 0x4e, 0x47)) }) };
    expect(await copyToStorage('https://cdn.x/a.png', { kind: 'image', ownerKey: 'u', fetchImpl: async () => big, upload }).catch((e) => e)).toMatchObject({ code: 'too_large' });
  });
});
