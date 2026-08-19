/**
 * ThumbnailTemplateCard.jsx
 *
 * Renders a single template card with preview image, name overlay,
 * category badge, and reference requirement indicator.
 *
 * Thumbnail resolution uses the same candidate chain as TemplateStudio
 * (getTemplateThumbnailCandidates) so the design-grid images match what
 * the studio pages show. Falls through candidates on error.
 */

import { getTemplateThumbnailCandidates } from '../../../lib/thumbnails.js';

export class ThumbnailTemplateCard {
  constructor(options = {}) {
    this.template = options.template || null;
    this.appColors = options.appColors || { primary: '#d9ff00', accent: '#c4e600' };
    this.selected = options.selected || false;
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

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  render() {
    if (!this.template) return '';
    const t = this.template;
    const soft = this.getSoft();
    const isSelected = this.selected;

    // Resolve the thumbnail through the same candidate chain TemplateStudio
    // uses, so design-grid images match the studio page thumbnails.
    // Start with the template's own previewUrl (already mapped to an
    // on-disk asset), then fall through to the full candidate chain.
    const candidateChain = getTemplateThumbnailCandidates(t);
    const thumbUrl = t.previewUrl || (candidateChain.length > 0 && candidateChain[0]) || '';
    const fallbackUrls = [
      ...(candidateChain.length > 0 ? candidateChain.slice(1) : []),
    ];
    const gradient = thumbUrl
      ? null
      : `linear-gradient(135deg, ${this.primary}, ${this.accent})`;

    const previewStyle = gradient
      ? `background: ${gradient}`
      : '';

    return `
        <div class="thumbnail-template-card ${isSelected ? 'selected' : ''}"
             style="--app-primary:${this.primary};--app-soft:${soft}"
             data-action="${this.action}" data-id="${this.escapeHtml(t.id)}"
            tabindex="0"
            role="button"
            aria-pressed="${isSelected}"
            aria-label="${this.escapeHtml(t.name)} template">
         <div class="template-card-preview" ${previewStyle}>
           ${thumbUrl ? `<img src="${this.escapeHtml(thumbUrl)}" data-fallbacks="${this.escapeHtml(JSON.stringify(fallbackUrls))}" class="template-card-img" alt="${this.escapeHtml(t.name)} preview" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="window.__thumbCardErr(this)" />` : ''}
           ${t.requiresReference ? `
            <span class="template-card-badge reference-badge" title="Requires reference image">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Ref
            </span>
          ` : ''}
          <span class="template-card-badge category-badge">${this.escapeHtml(t.category)}</span>
        </div>
        <div class="template-card-info">
          <h4 class="template-card-name">${this.escapeHtml(t.name)}</h4>
          <p class="template-card-description">${this.escapeHtml(t.description)}</p>
          <div class="template-card-tags">
            ${t.tags.slice(0, 4).map((tag) => `<span class="template-tag">${this.escapeHtml(tag)}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }
}

export default ThumbnailTemplateCard;
