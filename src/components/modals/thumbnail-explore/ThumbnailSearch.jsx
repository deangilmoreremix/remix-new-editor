/**
 * ThumbnailSearch.jsx
 *
 * Renders a search input with debounced search (300ms).
 */

export class ThumbnailSearch {
  constructor(options = {}) {
    this.appColors = options.appColors || { primary: '#22d3ee', accent: '#34d399' };
    this.onSearch = options.onSearch || (() => {});
    this.placeholder = options.placeholder || 'Search templates...';
    this.value = options.value || '';
    this._debounceTimer = null;
  }

  get primary() { return this.appColors.primary; }
  get accent() { return this.appColors.accent; }

  hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  getSoft() { return this.hexToRgba(this.primary, 0.12); }

  render() {
    return `
      <div class="thumbnail-search" style="--app-primary:${this.primary};--app-soft:${this.getSoft()}">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <input type="text"
                 class="search-input"
                 placeholder="${this.placeholder}"
                 value="${this.escapeHtml(this.value)}"
                 autocomplete="off"
                 aria-label="Search templates" />
          ${this.value ? `
            <button type="button" class="search-clear" data-action="clear-search" aria-label="Clear search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  attachListeners(container) {
    if (!container) return;
    const input = container.querySelector('.search-input');
    const clearBtn = container.querySelector('.search-clear');

    if (input) {
      input.addEventListener('input', (e) => {
        const val = e.target.value;
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
          this.value = val;
          this.onSearch(val);
        }, 300);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.value = '';
        if (input) input.value = '';
        this.onSearch('');
      });
    }
  }
}

export default ThumbnailSearch;
