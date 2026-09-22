/**
 * Studio Pexels Helper
 *
 * Provides a simple API for any studio to open the Pexels browser
 * and receive a selected asset.
 *
 * Now backed by the unified StockMediaBrowser for consistency,
 * but locked to Pexels-only for backward compatibility.
 */

import StockMediaBrowser from '../components/StockMediaBrowser.js';

export async function browsePexels({ accept = ['image', 'video'], onSelect, onCancel, title, studioName, onDownload }) {
  StockMediaBrowser.openStockMediaBrowser({
    accept,
    providers: [StockMediaBrowser.PROVIDERS.PEXELS],
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
 * Convenience: browse for images only.
 */
export async function browsePexelsImages({ onSelect, onDownload, title, studioName }) {
  return browsePexels({ accept: ['image'], onSelect, onDownload, title, studioName });
}

/**
 * Convenience: browse for videos only.
 */
export async function browsePexelsVideos({ onSelect, onDownload, title, studioName }) {
  return browsePexels({ accept: ['video'], onSelect, onDownload, title, studioName });
}
