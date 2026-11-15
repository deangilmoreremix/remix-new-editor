/**
 * VideoPersonalizationHub.jsx
 *
 * The old "Personalization Suite" window simulated video generation. Personalization
 * now lives in the real Personalize window (src/features/personalization): clients,
 * business assets, background removal, the guided overlay editor and per-client
 * export. This class keeps the name and the `new VideoPersonalizationHub(opts).open()`
 * API that the Timeline Editor and the CineGen editor call, and opens that window.
 *
 *   options.onComplete(completion)  called when the window finishes a run
 *   options.onError(error)          called if the window could not be opened
 */
import { BaseModal } from './BaseModal.jsx';

export class VideoPersonalizationHub extends BaseModal {
  constructor(options = {}) {
    super({ title: 'Personalization', size: 'full', showFooter: false, ...options });
    this.hubOptions = options;
  }

  renderBody() {
    return '<p>Opening the Personalize window…</p>';
  }

  /** Opens the Personalize window instead of drawing a dialog of its own. */
  open() {
    const { onComplete, onError, openOptions } = this.hubOptions;
    return import('../../features/personalization/mount.jsx')
      .then((m) => m.openPersonalization({
        studioId: 'timeline',
        studioName: 'Timeline Editor',
        appId: 'ai-video-agent',
        ...(openOptions || {}),
        onComplete: (completion) => { try { onComplete?.(completion); } catch (err) { onError?.(err); } },
      }))
      .catch((err) => { (onError || (() => {}))(err); });
  }

  close() { /* the Personalize window closes itself */ }
}

export default VideoPersonalizationHub;
