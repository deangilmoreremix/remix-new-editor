/**
 * ThumbnailCategoryFilter.jsx
 *
 * Renders horizontal scrollable category filter chips.
 */

export class ThumbnailCategoryFilter {
  constructor(options = {}) {
    this.categories = options.categories || ['all', 'recommended', 'popular'];
    this.activeCategory = options.activeCategory || 'all';
    this.appColors = options.appColors || { primary: '#d9ff00', accent: '#c4e600' };
    this.onSelectCategory = options.onSelectCategory || (() => {});
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
      <div class="thumbnail-category-filter" style="--app-primary:${this.primary};--app-soft:${this.getSoft()}" role="tablist" aria-label="Template categories">
        ${this.categories.map((cat) => {
          const isActive = this.activeCategory === cat;
          const label = cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1);
          return `
            <button type="button"
                    class="category-chip ${isActive ? 'active' : ''}"
                    style="${isActive ? `background:${this.primary};color:#05070b;` : ''}"
                    data-action="select-category"
                    data-category="${cat}"
                    role="tab"
                    aria-selected="${isActive}"
                    aria-label="${label}">
              ${label}
            </button>
          `;
        }).join('')}
      </div>
    `;
  }
}

export default ThumbnailCategoryFilter;
