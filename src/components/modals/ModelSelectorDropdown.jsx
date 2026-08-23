import { mountModelSelector } from '../../lib/modelSelectorUI.js';

export class ModelSelectorDropdown {
  constructor(anchorBtn, { models = [], selectedModel = null, onSelect = () => {} } = {}) {
    this.anchorBtn = anchorBtn;
    this.models = this._normalizeModels(models);
    this.selectedModel = selectedModel;
    this.onSelect = onSelect;
    this.selectedProvider = 'all';
    this.searchQuery = '';
    this._popover = null;
    this._isOpen = false;
    this._onDocClick = this._handleDocClick.bind(this);
    this._onKeydown = this._handleKeydown.bind(this);
  }

  _normalizeModels(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(m => {
      if (typeof m === 'string') {
        return { id: m, name: m, provider: 'openai', provider_name: 'OpenAI' };
      }
      return {
        id: m.id || m.name || '',
        name: m.name || m.id || '',
        provider: m.provider || 'openai',
        provider_name: m.provider_name || 'OpenAI',
      };
    });
  }

  _getFilteredModels() {
    return [];
  }

  _getAvailableProviders() {
    return [];
  }

  open() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._popover = this._createPopover();
    document.body.appendChild(this._popover);
    this._positionPopover();
    document.addEventListener('click', this._onDocClick);
    document.addEventListener('keydown', this._onKeydown);
    requestAnimationFrame(() => {
      const selected = this._popover.querySelector(`[data-model-id="${this.selectedModel}"]`);
      if (selected) selected.scrollIntoView({ block: 'nearest' });
    });
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    if (this._popover) {
      this._popover.remove();
      this._popover = null;
    }
    document.removeEventListener('click', this._onDocClick);
    document.removeEventListener('keydown', this._onKeydown);
  }

  destroy() {
    this.close();
  }

  _createPopover() {
    const popover = document.createElement('div');
    popover.className = 'model-selector-dropdown';
    popover.style.cssText = `
      display: flex;
      width: min(520px, calc(100vw - 16px));
      max-height: 70vh;
      background: #0a0a0b;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
      overflow: hidden;
    `;

    mountModelSelector(popover, {
      models: this.models,
      selectedModelId: this.selectedModel,
      showProviderName: true,
      onSelectModel: (modelId) => {
        const model = this.models.find((m) => m.id === modelId);
        if (model) {
          this.onSelect(model);
          this.close();
        }
      },
    });

    return popover;
  }

  _bindSidebarEvents() {
  }

  _renderModelList() {
  }

  _bindEvents() {
  }

  _positionPopover() {
    if (!this._popover || !this.anchorBtn) return;
    const rect = this.anchorBtn.getBoundingClientRect();
    const popoverHeight = this._popover.offsetHeight || 360;
    let top = rect.top + window.scrollY - popoverHeight - 8;
    let left = rect.left + window.scrollX;

    if (top < 8) {
      top = rect.bottom + window.scrollY + 8;
    }

    const popoverWidth = 520;
    left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8));

    this._popover.style.position = 'absolute';
    this._popover.style.top = `${top}px`;
    this._popover.style.left = `${left}px`;
  }

  _handleDocClick(e) {
    if (this._popover && !this._popover.contains(e.target) && e.target !== this.anchorBtn) {
      this.close();
    }
  }

  _handleKeydown(e) {
    if (e.key === 'Escape') {
      this.close();
    }
  }
}
