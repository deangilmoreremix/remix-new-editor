import { BaseModal } from './BaseModal.jsx';
import { executeExtend } from '../../lib/editor/timelineAI.js';

export class ExtendModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Extend Clip',
      size: 'medium',
      showFooter: true,
      ...options
    });

    this.selectedClipId = options.clipId || null;
    this.duration = 5;
    this.style = 'seamless';
    this.status = 'idle'; // idle | running | done | error
    this.result = null;
    this.error = null;
  }

  renderBody() {
    return `
      <div class="extend-modal">
        <div class="form-group">
          <label>Additional Duration (seconds)</label>
          <input type="number" id="extendDuration" value="${this.duration}" min="1" max="60" />
        </div>
        <div class="form-group">
          <label>Style</label>
          <select id="extendStyle">
            <option value="seamless">Seamless</option>
            <option value="loop">Loop</option>
            <option value="generative">Generative</option>
          </select>
        </div>
        <div class="extend-status" data-status="${this.status}">
          ${this.status === 'running' ? '<div class="progress-bar"><div class="progress-fill" style="width:40%"></div></div><p>Extending clip...</p>' : ''}
          ${this.status === 'done' ? `<p>✅ Extended by ${this.result?.addedDuration || this.duration}s.</p>` : ''}
          ${this.status === 'error' ? `<p class="error">❌ ${this.error || 'Extension failed'}</p>` : ''}
        </div>
      </div>
    `;
  }

  renderFooter() {
    return `
      <button class="btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn-primary" data-action="extend" ${this.status === 'running' ? 'disabled' : ''}>Extend Clip</button>
    `;
  }

  mount(container) {
    super.mount(container);
    this.container.querySelector('[data-action="extend"]')?.addEventListener('click', () => this.extend());
    this.container.querySelector('[data-action="cancel"]')?.addEventListener('click', () => this.close());
  }

  async extend() {
    if (!this.selectedClipId) {
      this.error = 'No clip selected';
      this.status = 'error';
      this.refresh();
      this.onError(this.error);
      return;
    }

    const duration = parseFloat(this.container.querySelector('#extendDuration')?.value || '5');
    const style = this.container.querySelector('#extendStyle')?.value || 'seamless';

    this.status = 'running';
    this.error = null;
    this.refresh();

    try {
      const result = await executeExtend(this.state, {
        clipId: this.selectedClipId,
        duration,
        direction: 'after',
        style,
      }, this.showToast);

      this.result = result;
      this.status = result?.success ? 'done' : 'error';
      this.error = result?.error || null;
      this.refresh();
      if (result?.success) {
        this.onComplete({ ...result, tool: 'extend' });
      } else {
        this.onError(this.error);
      }
    } catch (e) {
      this.error = e.message || 'Extension failed';
      this.status = 'error';
      this.refresh();
      this.onError(this.error);
    }
  }
}

export default ExtendModal;
