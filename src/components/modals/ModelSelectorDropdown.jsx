import {
  PROVIDER_LOGOS,
  invertLogos,
  getProviderStyle,
  getAvailableProviders,
  filterModels,
  renderProviderSidebar,
  renderSearchBar,
  renderModelList,
} from '../../lib/modelSelectorUI.js';

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
    return filterModels(this.models, this.searchQuery, this.selectedProvider);
  }

  _getAvailableProviders() {
    return getAvailableProviders(this.models);
  }

  open() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._popover = this._createPopover();
    document.body.appendChild(this._popover);
    this._positionPopover();
    this._bindEvents();
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

    const container = document.createElement('div');
    container.className = 'model-selector-container';
    container.style.cssText = `
      display: flex;
      width: min(520px, calc(100vw - 16px));
      max-height: 70vh;
      background: #0a0a0b;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
      overflow: hidden;
    `;

    const sidebar = document.createElement('div');
    sidebar.className = 'model-selector-sidebar';
    sidebar.style.cssText = `
      width: 56px;
      overflow-y: auto;
      padding: 8px 4px;
      border-right: 1px solid rgba(255,255,255,0.05);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    `;
    const providers = this._getAvailableProviders();
    sidebar.innerHTML = renderProviderSidebar(providers, this.selectedProvider, () => {});
    this._sidebar = sidebar;

    const mainPane = document.createElement('div');
    mainPane.className = 'model-selector-main';
    mainPane.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
    `;

    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = `
      padding: 12px 12px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      flex-shrink: 0;
    `;
    searchWrap.innerHTML = renderSearchBar();
    this._searchInput = searchWrap.querySelector('input');

    const modelList = document.createElement('div');
    modelList.className = 'model-list-container';
    modelList.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
    `;
    this._modelList = modelList;

    mainPane.appendChild(searchWrap);
    mainPane.appendChild(modelList);
    container.appendChild(sidebar);
    container.appendChild(mainPane);
    popover.appendChild(container);

    return popover;
  }

  _bindSidebarEvents() {
    if (!this._sidebar) return;
    this._sidebar.querySelectorAll('button[data-provider]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedProvider = btn.getAttribute('data-provider');
        const providers = this._getAvailableProviders();
        this._sidebar.innerHTML = renderProviderSidebar(providers, this.selectedProvider, () => {});
        this._bindSidebarEvents();
        this._renderModelList();
      });
    });
  }

  _renderModelList() {
    const filtered = this._getFilteredModels();
    this._modelList.innerHTML = renderModelList(filtered, this.selectedModel, true);

    this._modelList.querySelectorAll('[data-model-id]').forEach(el => {
      el.addEventListener('click', () => {
        const modelId = el.getAttribute('data-model-id');
        const model = this.models.find(m => m.id === modelId);
        if (model) {
          this.onSelect(model);
          this.close();
        }
      });
    });
  }

  _bindEvents() {
    this._bindSidebarEvents();
    if (this._searchInput) {
      this._searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this._renderModelList();
      });
    }
    this._renderModelList();
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
