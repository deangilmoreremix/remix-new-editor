// [remix] Fix B1: glue between the media adapter and the IndexedDB blob store (lib/media/local-blob-store.ts).
// persistLocalMedia: called when a local file / recording is imported. restoreLocalMedia: called when a project loads.
import { localBlobStore } from '@cinegen/lib/media/local-blob-store';
import { probeSource } from '@cinegen/lib/perf/relink';
import { webFiles } from './web-media';

export const LOCAL_MEDIA_EVENT = 'cinegen:local-media';
const say = (detail: { kind: 'persist-failed' | 'restored' | 'missing'; message: string }) => { try { window.dispatchEvent(new CustomEvent(LOCAL_MEDIA_EVENT, { detail })); } catch { /* no window */ } };
const pending = new Set<Promise<unknown>>();
/** Resolves when every write started so far has finished (tests / smoke scripts wait on it before reloading). */
export const localMediaIdle = async () => { while (pending.size) await Promise.all([...pending]); };

/** Keep the file behind a blob: URL for the next session. Other URLs (https, data:) are already durable. Never throws. */
export function persistLocalMedia(assetId: string, url: string, projectId?: string): Promise<void> {
  if (!/^blob:/i.test(url)) return Promise.resolve();
  const p = (async () => {
    try {
      const blob = await (await fetch(url)).blob();
      const meta = webFiles.get(url);
      const r = await localBlobStore.put(assetId, blob, { name: meta?.name ?? assetId, type: meta?.type || blob.type, projectId });
      if (!r.ok) { console.warn('[local-media]', r.message); say({ kind: 'persist-failed', message: r.message }); }
    } catch (e) { console.warn('[local-media] not kept for the next session', e); }
  })();
  pending.add(p); void p.finally(() => pending.delete(p));
  return p;
}

type A = { id: string; name?: string; url?: string; fileRef?: string; proxyRef?: string; type?: string; fileSize?: number };
/** Replace dead blob: URLs of a loaded project's assets with live ones from the stored files; then clean up entries of deleted assets. */
export async function restoreLocalMedia<T extends A>(assets: T[], projectId?: string): Promise<T[]> {
  if (!assets.some((a) => /^blob:/i.test(a.url ?? '') || /^blob:/i.test(a.fileRef ?? ''))) { void localBlobStore.prune(projectId ?? '', assets.map((a) => a.id)); return assets; }
  try {
    const r = await localBlobStore.restoreAssets(assets, {
      projectId, isLive: (u) => probeSource(u),
      onRestored: (a, url, e) => { webFiles.set(url, { name: e.name, type: e.type, size: e.size }); (window as unknown as { __remixFileNames?: Map<string, string> }).__remixFileNames?.set(url, e.name); },
    });
    if (r.restored.length) say({ kind: 'restored', message: `Restored ${r.restored.length} imported file${r.restored.length === 1 ? '' : 's'} from this browser.` });
    if (r.missing.length) say({ kind: 'missing', message: `${r.missing.length} imported file${r.missing.length === 1 ? ' is' : 's are'} no longer stored in this browser; relink ${r.missing.length === 1 ? 'it' : 'them'} in Media health.` });
    if (projectId) void localBlobStore.prune(projectId, assets.map((a) => a.id));
    return r.assets;
  } catch (e) { console.warn('[local-media] restore failed', e); return assets; }
}
