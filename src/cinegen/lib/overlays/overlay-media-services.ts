// [remix] What the overlay settings need for pictures that are not a contact's: upload a file, pick from the project's own images,
// search Pixabay / Pexels, and the sticker library. Ported from the classic editor's settings services (TimelineEditorPage.jsx
// addonEditorServices) so the Image and Stickers overlays work the same here. The stock clients are loaded when first used.
import { STICKER_LIBRARY, ANIMATED_EMOJI } from '../../../lib/editor/addons/overlayData.js';
import { STOCK_SOURCES, createStockSearch } from '../../../lib/editor/addons/stockMedia.js';
import type { Asset } from '@cinegen/types/project';

export interface MediaHost { notify: (message: string, kind?: 'info' | 'error' | 'success') => void; assets: () => Asset[] }
interface StockItem { id?: string; src: string; mustCopy?: boolean }

let search: ((kind: string, source: string, query: string) => Promise<unknown>) | null = null;
async function stockSearch(kind: string, source: string, query: string) {
  if (!search) {
    const [pix, pex] = await Promise.all([import('../../../lib/pixabayApi.js'), import('../../../lib/pexelsApi.js')]);
    search = createStockSearch({
      pixabay: { searchImages: pix.searchPixabayImages, searchVideos: pix.searchPixabayVideos },
      pexels: { searchPhotos: pex.searchPhotos, searchVideos: pex.searchVideos },
    }) as typeof search;
  }
  return search!(kind, source, query);
}

/** Store a picked file: the project's storage when there is one, else a local preview that lives only in this browser. */
async function storeFile(file: File, host: MediaHost): Promise<string> {
  try {
    const { uploadFileToStorage } = await import('../../../lib/hybrid-supabase.js');
    const out = await uploadFileToStorage(file);
    const url = typeof out === 'string' ? out : (out as { url?: string } | null)?.url;
    if (url) return url;
  } catch (err) { console.warn('[Overlays] upload failed, using a local preview URL', err); }
  host.notify('Upload unavailable: using a local preview of the file (it will not be saved with the project).', 'info');
  const { localMediaUrl } = await import('../../../lib/editor/remotion/localMedia.js');
  return localMediaUrl(file) as string;
}

export function overlayMediaServices(host: MediaHost) {
  return {
    stockSources: STOCK_SOURCES,
    searchStock: stockSearch,
    // Pixabay does not allow permanent hotlinking: a picked Pixabay image is copied to storage first. Pexels images and stock videos use their CDN.
    importStockImage: async (item: StockItem) => {
      if (!item?.mustCopy) return item?.src;
      try {
        const res = await fetch(item.src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        return await storeFile(new File([blob], `${item.id ?? 'stock'}.${ext}`, { type: blob.type || 'image/jpeg' }), host);
      } catch {
        host.notify("Couldn't save a copy of this Pixabay image; using Pixabay's link for now, which may expire.", 'info');
        return item.src;
      }
    },
    uploadFile: (file: File) => storeFile(file, host),
    onError: (err: Error) => host.notify(err?.message || 'Upload failed', 'error'),
    stickers: STICKER_LIBRARY,
    animatedEmoji: ANIMATED_EMOJI,
    /** The project's own images (Media pool) as one-click picks. */
    mediaImages: () => {
      const seen = new Set<string>();
      return host.assets()
        .filter((a) => a.type === 'image' && (a.url || a.fileRef))
        .map((a) => ({ name: a.name, src: a.url || a.fileRef || '', type: 'image' }))
        .filter((m) => (seen.has(m.src) ? false : (seen.add(m.src), true)));
    },
  };
}
