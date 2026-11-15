import { describe, it, expect } from 'vitest';
import { applyAssetToLibrary, writeAssetToStudioLibrary } from '../studioLibrarySync.js';

const logo = { id: 'l1', role: 'logo', url: 'https://a.test/logo.jpg' };
const cut = { ...logo, url: 'https://a.test/cut.png', originalUrl: logo.url, edited: true, hasTransparency: true };
const library = () => ({ logos: [logo], primaryLogo: logo, identities: [], products: [{ id: 'p1', url: 'https://a.test/p.jpg' }], brandReferences: [] });
const store = (data) => { const m = new Map(Object.entries(data)); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), dump: (k) => JSON.parse(m.get(k)) }; };

describe('applyAssetToLibrary', () => {
  it('replaces the asset in its list and as the primary, leaving others alone', () => {
    const { library: next, changed } = applyAssetToLibrary(library(), 'l1', cut);
    expect(changed).toBe(true);
    expect(next.logos[0]).toMatchObject({ id: 'l1', url: 'https://a.test/cut.png', hasTransparency: true });
    expect(next.primaryLogo.url).toBe('https://a.test/cut.png');
    expect(next.products[0].url).toBe('https://a.test/p.jpg');
  });
  it('reports nothing changed for an unknown id and copes with no library', () => {
    expect(applyAssetToLibrary(library(), 'nope', cut).changed).toBe(false);
    expect(applyAssetToLibrary(null, 'l1', cut)).toEqual({ library: null, changed: false });
  });
  it('keeps the asset id even if the patch carries another', () => {
    expect(applyAssetToLibrary(library(), 'l1', { ...cut, id: 'other' }).library.logos[0].id).toBe('l1');
  });
});

describe('writeAssetToStudioLibrary', () => {
  it('writes the edit into the client\'s saved library', () => {
    const s = store({ smartvideo_client_assets: JSON.stringify({ c1: library(), c2: library() }) });
    expect(writeAssetToStudioLibrary('c1', 'l1', cut, s)).toBe(true);
    expect(s.dump('smartvideo_client_assets').c1.logos[0].hasTransparency).toBe(true);
    expect(s.dump('smartvideo_client_assets').c2.logos[0].hasTransparency).toBeUndefined();
  });
  it('does nothing for a contact the studio does not know (e.g. a lead), or an unknown asset', () => {
    const s = store({ smartvideo_client_assets: JSON.stringify({ c1: library() }) });
    expect(writeAssetToStudioLibrary('lead-9', 'l1', cut, s)).toBe(false);
    expect(writeAssetToStudioLibrary('c1', 'zzz', cut, s)).toBe(false);
  });
  it('never writes a blob: url, which dies with the tab', () => {
    const s = store({ smartvideo_client_assets: JSON.stringify({ c1: library() }) });
    expect(writeAssetToStudioLibrary('c1', 'l1', { ...cut, url: 'blob:http://x/1' }, s)).toBe(false);
    expect(s.dump('smartvideo_client_assets').c1.logos[0].url).toBe('https://a.test/logo.jpg');
  });
  it('survives unreadable storage and a full disk', () => {
    expect(writeAssetToStudioLibrary('c1', 'l1', cut, { getItem: () => '{not json', setItem() {} })).toBe(false);
    expect(writeAssetToStudioLibrary('c1', 'l1', cut, { getItem: () => JSON.stringify({ c1: library() }), setItem() { throw new Error('quota'); } })).toBe(false);
    expect(writeAssetToStudioLibrary('', 'l1', cut, store({}))).toBe(false);
  });
});
