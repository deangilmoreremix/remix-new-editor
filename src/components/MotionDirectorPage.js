// src/components/MotionDirectorPage.js
//
// Motion Director (routes: #/motion-director and #/motion-director/workbench),
// ported from OpenHiggsBolt (src/apps/motion-director).
//
// The chat (#/motion-director) plans a film from a prompt and the person's
// website: it captures the real pages, writes a storyboard from 150 shot
// recipes and builds an editable film. The Motion Workbench
// (#/motion-director/workbench) is its editor: timeline, recipe library,
// theme, inspector and MP4 export. Both are one React app, mounted inside the
// personalization React tree (see src/features/personalization/mount.jsx) so
// "Use My Brand" shares the personalization modal's clients and assets.

import { installPersonalizationApiAuth } from '../features/personalization/lib/apiAuth.ts';

export function MotionDirectorPage() {
  installPersonalizationApiAuth();

  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-hidden bg-app-bg text-white';
  container.dataset.studio = 'motion-director';

  const host = document.createElement('div');
  host.className = 'w-full h-full';
  container.appendChild(host);

  let unmount = null;
  let disposed = false;
  import('../features/personalization/mount.jsx')
    .then(({ mountMotionDirector }) => mountMotionDirector(host))
    .then((fn) => {
      if (disposed) fn();
      else unmount = fn;
    })
    .catch((err) => {
      console.error('[MotionDirector] failed to load', err);
      host.innerHTML = '';
      const msg = document.createElement('div');
      msg.className = 'w-full h-full flex items-center justify-center text-sm text-red-400';
      msg.textContent = 'Motion Director could not be loaded. Please reload the page.';
      host.appendChild(msg);
    });

  // The shell router calls cleanup() when it leaves this page.
  container.cleanup = () => {
    disposed = true;
    if (unmount) unmount();
    unmount = null;
  };

  return container;
}
