/**
 * Studio Stock Media Helper
 *
 * Provides a simple API for any studio to open the unified stock media browser
 * (Pexels, Pixabay, Giphy) and receive a selected asset.
 *
 * This replaces and extends the old studioPexels.js with multi-provider support.
 */

import { openStockMediaBrowser, PROVIDERS, MEDIA_TYPES, clearAllStockMediaCaches } from '../components/StockMediaBrowser.js';

/**
 * Open the unified stock media browser with all available providers.
 *
 * @param {Object} options
 * @param {Array<string>} [options.accept=['image','video','gif']] - Media types to accept
 * @param {Function} [options.onSelect] - Called with selected asset
 * @param {Function} [options.onCancel] - Called when browser is cancelled
 * @param {Function} [options.onDownload] - Called with (item, url) for download
 * @param {string} [options.title='Stock Media'] - Browser title
 * @param {string} [options.studioName='Studio'] - Studio name for context
 */
export async function browseStockMedia({ accept = ['image', 'video', 'gif'], onSelect, onCancel, onDownload, title, studioName }) {
  openStockMediaBrowser({
    accept,
    onSelect: (asset) => {
      if (onSelect) onSelect(asset);
    },
    onCancel: () => {
      if (onCancel) onCancel();
    },
    onDownload: onDownload ? async (item, url) => onDownload(item, url) : undefined,
    title: title || 'Stock Media',
    studioName: studioName || 'Studio',
  });
}

/**
 * Convenience: browse for images only (from any provider).
 */
export async function browseStockImages({ onSelect, onDownload, title, studioName }) {
  return browseStockMedia({ accept: ['image'], onSelect, onDownload, title, studioName });
}

/**
 * Convenience: browse for videos only (from any provider).
 */
export async function browseStockVideos({ onSelect, onDownload, title, studioName }) {
  return browseStockMedia({ accept: ['video'], onSelect, onDownload, title, studioName });
}

/**
 * Convenience: browse for GIFs only.
 */
export async function browseStockGifs({ onSelect, onDownload, title, studioName }) {
  return browseStockMedia({ accept: ['gif'], onSelect, onDownload, title, studioName });
}

/**
 * Convenience: browse Pexels only (legacy behavior).
 */
export async function browsePexels({ accept = ['image', 'video'], onSelect, onCancel, onDownload, title, studioName }) {
  openStockMediaBrowser({
    accept,
    providers: [PROVIDERS.PEXELS],
    onSelect: (asset) => {
      if (onSelect) onSelect(asset);
    },
    onCancel: () => {
      if (onCancel) onCancel();
    },
    onDownload: onDownload ? async (item, url) => onDownload(item, url) : undefined,
    title: title || 'Pexels Stock Media',
    studioName: studioName || 'Studio',
  });
}

/**
 * Convenience: browse for Pexels images only.
 */
export async function browsePexelsImages({ onSelect, onDownload, title, studioName }) {
  return browsePexels({ accept: ['image'], onSelect, onDownload, title, studioName });
}

/**
 * Convenience: browse for Pexels videos only.
 */
export async function browsePexelsVideos({ onSelect, onDownload, title, studioName }) {
  return browsePexels({ accept: ['video'], onSelect, onDownload, title, studioName });
}

/**
 * Convenience: browse Pixabay only.
 */
export async function browsePixabay({ accept = ['image', 'video'], onSelect, onCancel, onDownload, title, studioName }) {
  openStockMediaBrowser({
    accept,
    providers: [PROVIDERS.PIXABAY],
    onSelect: (asset) => {
      if (onSelect) onSelect(asset);
    },
    onCancel: () => {
      if (onCancel) onCancel();
    },
    onDownload: onDownload ? async (item, url) => onDownload(item, url) : undefined,
    title: title || 'Pixabay Stock Media',
    studioName: studioName || 'Studio',
  });
}

/**
 * Convenience: browse for Pixabay images only.
 */
export async function browsePixabayImages({ onSelect, onDownload, title, studioName }) {
  return browsePixabay({ accept: ['image'], onSelect, onDownload, title, studioName });
}

/**
 * Convenience: browse for Pixabay videos only.
 */
export async function browsePixabayVideos({ onSelect, onDownload, title, studioName }) {
  return browsePixabay({ accept: ['video'], onSelect, onDownload, title, studioName });
}

/**
 * Convenience: browse Giphy only.
 */
export async function browseGiphy({ accept = ['gif', 'sticker'], onSelect, onCancel, onDownload, title, studioName }) {
  openStockMediaBrowser({
    accept,
    providers: [PROVIDERS.GIPHY],
    onSelect: (asset) => {
      if (onSelect) onSelect(asset);
    },
    onCancel: () => {
      if (onCancel) onCancel();
    },
    onDownload: onDownload ? async (item, url) => onDownload(item, url) : undefined,
    title: title || 'Giphy Media',
    studioName: studioName || 'Studio',
  });
}

/**
 * Convenience: browse for Giphy GIFs only.
 */
export async function browseGiphyGifs({ onSelect, onDownload, title, studioName }) {
  return browseGiphy({ accept: ['gif'], onSelect, onDownload, title, studioName });
}

/**
 * Convenience: browse for Giphy stickers only.
 */
export async function browseGiphyStickers({ onSelect, onDownload, title, studioName }) {
  return browseGiphy({ accept: ['sticker'], onSelect, onDownload, title, studioName });
}

/**
 * Download a stock media asset to the user's machine.
 */
export async function downloadStockMediaAsset(item, url) {
  const a = document.createElement('a');
  a.href = url;
  const ext = item.type === 'video' ? 'mp4' : (item.type === 'gif' || item.type === 'sticker' ? 'gif' : 'jpg');
  const name = (item.name || 'stock-media').replace(/[^a-z0-9]+/gi, '-').slice(0, 64);
  a.download = `${name}.${ext}`;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Clear all stock media caches.
 */
export { clearAllStockMediaCaches };

export default {
  browseStockMedia,
  browseStockImages,
  browseStockVideos,
  browseStockGifs,
  browsePexels,
  browsePexelsImages,
  browsePexelsVideos,
  browsePixabay,
  browsePixabayImages,
  browsePixabayVideos,
  browseGiphy,
  browseGiphyGifs,
  browseGiphyStickers,
  downloadStockMediaAsset,
  clearAllStockMediaCaches,
  PROVIDERS,
  MEDIA_TYPES,
};
