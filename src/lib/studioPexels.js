/**
 * Studio Pexels Helper
 *
 * Provides a simple API for any studio to open the Pexels browser
 * and receive a selected asset.
 */

export async function browsePexels({ accept = ['image', 'video'], onSelect, title, studioName }) {
  const { openPexelsBrowser } = await import('../components/PexelsBrowser.js');
  
  openPexelsBrowser({
    accept,
    onSelect: (asset) => {
      if (onSelect) onSelect(asset);
    },
    onCancel: () => {
      // User closed browser without selecting
    },
    title: title || 'Stock Media',
    studioName: studioName || 'Studio',
  });
}

/**
 * Convenience: browse for images only
 */
export async function browsePexelsImages({ onSelect, title, studioName }) {
  return browsePexels({ accept: ['image'], onSelect, title, studioName });
}

/**
 * Convenience: browse for videos only
 */
export async function browsePexelsVideos({ onSelect, title, studioName }) {
  return browsePexels({ accept: ['video'], onSelect, title, studioName });
}
