/**
 * ThumbnailTemplateCard.jsx
 *
 * Renders a single template card with preview image, name overlay,
 * category badge, and reference requirement indicator.
 */

export class ThumbnailTemplateCard {
  constructor(options = {}) {
    this.template = options.template || null;
    this.appColors = options.appColors || { primary: '#22d3ee', accent: '#34d399' };
    this.onSelect = options.onSelect || (() => {});
    this.selected = options.selected || false;
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
    if (!this.template) return '';
    const t = this.template;
    const soft = this.getSoft();
    const isSelected = this.selected;
    const gradient = t.previewUrl
      ? `url(${t.previewUrl})`
      : `linear-gradient(135deg, ${this.primary}, ${this.accent})`;

    return `
      <div class="thumbnail-template-card ${isSelected ? 'selected' : ''}"
           style="--app-primary:${this.primary};--app-soft:${soft}"
           data-action="select-template" data-id="${t.id}"
           tabindex="0"
           role="button"
           aria-pressed="${isSelected}"
           aria-label="${t.name} template">
        <div class="template-card-preview" style="background: ${gradient}">
          ${t.requiresReference ? `
            <span class="template-card-badge reference-badge" title="Requires reference image">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Ref
            </span>
          ` : ''}
          <span class="template-card-badge category-badge">${t.category}</span>
        </div>
        <div class="template-card-info">
          <h4 class="template-card-name">${t.name}</h4>
          <p class="template-card-description">${t.description}</p>
          <div class="template-card-tags">
            ${t.tags.slice(0, 4).map((tag) => `<span class="template-tag">${tag}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }
}

export default ThumbnailTemplateCard;
