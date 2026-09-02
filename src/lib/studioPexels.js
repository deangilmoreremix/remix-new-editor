/**
 * Studio Pexels Helper
 *
 * Provides a simple API for any studio to open the Pexels browser
 * and receive a selected asset.
 */

export async function browsePexels({ accept = ['image', 'video'], onSelect, onCancel, title, studioName, onDownload }) {
  const { openPexelsBrowser } = await import('../components/PexelsBrowser.js');
  
  openPexelsBrowser({
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
 * Convenience: browse for images only
 */
export async function browsePexelsImages({ onSelect, onDownload, title, studioName }) {
  return browsePexels({ accept: ['image'], onSelect, onDownload, title, studioName });
}

/**
 * Convenience: browse for videos only
 */
export async function browsePexelsVideos({ onSelect, onDownload, title, studioName }) {
  return browsePexels({ accept: ['video'], onSelect, onDownload, title, studioName });
}

/**
 * Download a Pexels asset to the user's machine.
 */
export async function downloadPexelsAsset(item, url) {
  const a = document.createElement('a');
  a.href = url;
  a.download = (item.alt || 'pexels-media').replace(/[^a-z0-9]+/gi, '-').slice(0, 64);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
