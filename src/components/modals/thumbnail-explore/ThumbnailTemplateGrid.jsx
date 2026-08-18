/**
 * ThumbnailTemplateGrid.jsx
 *
 * Renders a responsive grid of template cards with lazy loading
 * and smooth scrolling.
 */

import { ThumbnailTemplateCard } from './ThumbnailTemplateCard.jsx';

export class ThumbnailTemplateGrid {
  constructor(options = {}) {
    this.templates = options.templates || [];
    this.appColors = options.appColors || { primary: '#d9ff00', accent: '#c4e600' };
    this.selectedId = options.selectedId || null;
    this.action = options.action || 'select-template';
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
      <div class="thumbnail-template-grid" style="--app-primary:${this.primary};--app-soft:${this.getSoft()}">
        ${this.templates.map((t) => {
          const isSelected = this.selectedId === t.id;
          return new ThumbnailTemplateCard({
            template: t,
            appColors: this.appColors,
            selected: isSelected,
            action: this.action,
          }).render();
        }).join('')}
      </div>
    `;
  }
}

export default ThumbnailTemplateGrid;
