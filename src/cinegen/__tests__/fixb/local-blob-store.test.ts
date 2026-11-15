import { describe, it, expect } from 'vitest';
import { LocalBlobStore, memoryBlobBackend, ORPHAN_GRACE_MS, type BlobBackend } from '../../lib/media/local-blob-store';

const mk = (s: string) => new Blob([s], { type: 'video/mp4' });
describe('LocalBlobStore', () => {
  it('restores dead blob urls from stored files, leaves live and remote urls', async () => {
    const st = new LocalBlobStore(memoryBlobBackend());
    await st.put('a1', mk('AAAA'), { name: 'a.mp4' });
    const made: Blob[] = [];
    const r = await st.restoreAssets(
      [{ id: 'a1', url: 'blob:old1', fileRef: 'blob:old1', proxyRef: 'blob:p' }, { id: 'a2', url: 'https://x/y.mp4' }, { id: 'a3', url: 'blob:gone' }, { id: 'a4', url: 'blob:live' }],
      { projectId: 'p1', isLive: async (u) => u === 'blob:live', makeUrl: (b) => { made.push(b); return 'blob:new'; } },
    );
    expect(r.restored).toEqual(['a1']); expect(r.missing).toEqual(['a3']);
    expect(r.assets[0]).toMatchObject({ url: 'blob:new', fileRef: 'blob:new', proxyRef: undefined });
    expect(r.assets[1].url).toBe('https://x/y.mp4'); expect(r.assets[3].url).toBe('blob:live');
    expect(made[0].size).toBe(4);
    expect((await st.get('a1'))?.projectId).toBe('p1');
  });
  it('quota: evicts week-old entries once and retries; reports failure without throwing', async () => {
    const inner = memoryBlobBackend(); let full = true; let now = 1e12;
    const b: BlobBackend = { ...inner, set: async (k, v) => { if (full && k === 'new') throw Object.assign(new Error('x'), { name: 'QuotaExceededError' }); return inner.set(k, v); } };
    const st = new LocalBlobStore(b, () => now);
    await st.put('old', mk('o'), { name: 'o' }); now += ORPHAN_GRACE_MS + 10;
    let r = await st.put('new', mk('n'), { name: 'n' });
    expect(r).toMatchObject({ ok: false, reason: 'quota' });
    expect(await st.get('old')).toBeUndefined(); // evicted during the retry
    full = false; r = await st.put('new', mk('n'), { name: 'n' }); expect(r.ok).toBe(true);
  });
  it('prune removes only old unreferenced entries of the project; removeProject clears it', async () => {
    let now = 1e12; const st = new LocalBlobStore(memoryBlobBackend(), () => now);
    await st.put('keep', mk('k'), { name: 'k', projectId: 'p' }); await st.put('gone', mk('g'), { name: 'g', projectId: 'p' }); await st.put('other', mk('o'), { name: 'o', projectId: 'q' });
    expect(await st.prune('p', ['keep'])).toBe(0); // inside grace (undo)
    now += ORPHAN_GRACE_MS + 1;
    expect(await st.prune('p', ['keep'])).toBe(1);
    expect(await st.get('gone')).toBeUndefined(); expect(await st.get('other')).toBeDefined();
    expect(await st.removeProject('q')).toBe(1);
  });
});
