import { BaseModal } from './BaseModal.jsx';
import { executeFillGap } from '../../lib/editor/timelineAI.js';

export class FillGapModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Fill Gap AI',
      size: 'medium',
      showFooter: true,
      ...options
    });

    this.selectedClipId = options.clipId || null;
    this.duration = 5;
    this.style = 'cinematic';
    this.status = 'idle'; // idle | running | done | error
    this.result = null;
    this.error = null;
  }

  renderBody() {
    return `
      <div class="fill-gap-modal">
        <div class="form-group">
          <label>Duration (seconds)</label>
          <input type="number" id="fillGapDuration" value="${this.duration}" min="1" max="60" />
        </div>
        <div class="form-group">
          <label>Style</label>
          <select id="fillGapStyle">
            <option value="cinematic">Cinematic</option>
            <option value="documentary">Documentary</option>
            <option value="social">Social / Short-form</option>
            <option value="abstract">Abstract</option>
          </select>
        </div>
        <div class="fill-gap-status" data-status="${this.status}">
          ${this.status === 'running' ? '<div class="progress-bar"><div class="progress-fill" style="width:40%"></div></div><p>Generating bridge footage...</p>' : ''}
          ${this.status === 'done' ? `<p>✅ Generated ${this.result?.duration || this.duration}s of footage.</p>` : ''}
          ${this.status === 'error' ? `<p class="error">❌ ${this.error || 'Generation failed'}</p>` : ''}
        </div>
      </div>
    `;
  }

  renderFooter() {
    return `
      <button class="btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn-primary" data-action="generate" ${this.status === 'running' ? 'disabled' : ''}>Generate Fill</button>
    `;
  }

  mount(container) {
    super.mount(container);
    this.container.querySelector('[data-action="generate"]')?.addEventListener('click', () => this.generate());
    this.container.querySelector('[data-action="cancel"]')?.addEventListener('click', () => this.close());
  }

  async generate() {
    if (!this.selectedClipId) {
      this.error = 'No clip selected';
      this.status = 'error';
      this.refresh();
      this.onError(this.error);
      return;
    }

    const duration = parseFloat(this.container.querySelector('#fillGapDuration')?.value || '5');
    const style = this.container.querySelector('#fillGapStyle')?.value || 'cinematic';

    this.status = 'running';
    this.error = null;
    this.refresh();

    try {
      const result = await executeFillGap(this.state, {
        clipId: this.selectedClipId,
        duration,
        style,
      }, this.showToast);

      this.result = result;
      this.status = result?.success ? 'done' : 'error';
      this.error = result?.error || null;
      this.refresh();
      if (result?.success) {
        this.onComplete({ ...result, tool: 'fill_gap' });
      } else {
        this.onError(this.error);
      }
    } catch (e) {
      this.error = e.message || 'Generation failed';
      this.status = 'error';
      this.refresh();
      this.onError(this.error);
    }
  }
}

export default FillGapModal;
