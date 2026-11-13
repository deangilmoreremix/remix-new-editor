import { BaseModal } from './BaseModal.jsx';

// Full-screen host for Recorder Studio (scenes, captions, style, export). The Studio itself is a
// React app that is loaded on demand, so the editor bundle only pays for it when it is opened.
export class RecorderStudioModal extends BaseModal {
  constructor(options = {}) {
    // Escape closes the caption editor inside the Studio, and a stray backdrop click must not abort
    // a render, so the drawer only closes with its X button.
    super({ title: 'Recorder Studio', size: 'full', showFooter: false, closeOnEscape: false, closeOnBackdrop: false, ...options });
    this.onAddToTimeline = options.onAddToTimeline || (() => {});
    this.unmount = null;
    this.mounting = false;
  }

  renderBody() {
    return '<div data-studio-root style="height:100%;min-height:560px"></div>';
  }

  setupEventListeners() {
    super.setupEventListeners();
    this.mountStudio();
  }

  async mountStudio() {
    const host = this.overlay?.querySelector('[data-studio-root]');
    if (!host || this.unmount || this.mounting) return;
    this.mounting = true;
    try {
      const { mountRecorderStudio } = await import('../../features/recorder-studio/mount.tsx');
      if (!this.overlay?.contains(host)) return; // closed while loading
      this.unmount = mountRecorderStudio(host, {
        onAddToTimeline: (result) => {
          this.onAddToTimeline(result);
          this.close();
        }
      });
    } catch (err) {
      console.error('Recorder Studio failed to load:', err);
      host.textContent = `Recorder Studio could not be loaded: ${err.message || err}`;
    } finally {
      this.mounting = false;
    }
  }

  close() {
    this.unmount?.();
    this.unmount = null;
    return super.close();
  }
}

export default RecorderStudioModal;
