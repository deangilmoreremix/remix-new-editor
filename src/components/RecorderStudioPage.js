// src/components/RecorderStudioPage.js
//
// Recorder studio (route: #/recorder): the Remotion Recorder in the browser. Record up to four
// sources, edit scenes, captions and B-roll, and export, without a local server.
// The React app lives in src/features/recorder (see its README).
import { mountStudioChrome } from '../lib/studioChrome.js';
import { createEditorBanner } from '../lib/thumbnails.js';

export function RecorderStudioPage() {
  const root = document.createElement('div');
  root.className = 'studio-short-scroll w-full h-full flex flex-col bg-app-bg overflow-hidden';
  const chrome = mountStudioChrome(root, { title: 'Recorder' });
  root.appendChild(createEditorBanner('recorder', 'Recorder', 'Record your screen and camera, then edit scenes, captions and B-roll'));
  const host = document.createElement('div');
  host.className = 'flex-1 min-h-0 studio-short-host';
  root.appendChild(host);
  let unmount = null;
  import('../features/recorder/mount.tsx').then(({ mountRecorderStudio }) => {
    if (unmount === false) return;
    unmount = mountRecorderStudio(host);
  });
  root.cleanup = () => {
    if (typeof unmount === 'function') unmount();
    unmount = false;
    chrome?.cleanup?.();
  };
  return root;
}
