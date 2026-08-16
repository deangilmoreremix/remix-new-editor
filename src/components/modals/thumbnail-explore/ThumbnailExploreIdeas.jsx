/**
 * ThumbnailExploreIdeas.jsx
 *
 * Main explore UI component that renders the ChatGPT-style "Explore Ideas" screen.
 * Returns an HTML string for embedding in the thumbnail modal.
 */

import { ThumbnailTemplateCard } from './ThumbnailTemplateCard.jsx';
import { ThumbnailTemplateGrid } from './ThumbnailTemplateGrid.jsx';
import { ThumbnailCategoryFilter } from './ThumbnailCategoryFilter.jsx';
import { ThumbnailSearch } from './ThumbnailSearch.jsx';
import { ThumbnailConfigurator } from './ThumbnailConfigurator.jsx';
import { THUMBNAIL_TEMPLATES, getTemplateCategories } from '../../../lib/thumbnailTemplateRegistry.js';
import { supabase } from '../../../lib/supabase.js';

const EDGE_FUNCTION = 'ai-thumbnail-generator';

export class ThumbnailExploreIdeas {
  constructor(options = {}) {
    this.appColors = options.appColors || { primary: '#22d3ee', accent: '#34d399' };
    this.onSelectTemplate = options.onSelectTemplate || (() => {});
    this.onTemplateSelect = options.onTemplateSelect || null;
    this.onBack = options.onBack || null;
    this.selectedTemplateId = null;
    this.activeCategory = 'all';
    this.searchQuery = '';
    this._searchDebounce = null;
    this.categories = getTemplateCategories();
    this.recommendedTemplates = [];
    this.popularTemplates = [];
    this._recommendationsLoaded = false;
    this._loadingRecommendations = false;
    this.loadRecommendations().catch(() => {});
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
  getSoftAccent() { return this.hexToRgba(this.accent, 0.12); }

  async loadRecommendations(context = {}) {
    if (this._loadingRecommendations) return;
    this._loadingRecommendations = true;
    try {
      const body = {
        action: 'recommend-templates',
        context: {
          ...context,
          category: this.activeCategory,
          searchQuery: this.searchQuery,
        },
      };
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
      if (!error && data?.templates) {
        this.recommendedTemplates = data.templates.recommended || [];
        this.popularTemplates = data.templates.popular || [];
      } else {
        this.recommendedTemplates = this.getCuratedRecommended();
        this.popularTemplates = this.getCuratedPopular();
      }
    } catch {
      this.recommendedTemplates = this.getCuratedRecommended();
      this.popularTemplates = this.getCuratedPopular();
    } finally {
      this._recommendationsLoaded = true;
      this._loadingRecommendations = false;
      this.rerender();
    }
  }

  async surpriseMe(context = {}) {
    try {
      const body = {
        action: 'surprise-me',
        context: {
          ...context,
          category: this.activeCategory,
          searchQuery: this.searchQuery,
        },
      };
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
      if (!error && data?.template) {
        return data.template;
      }
    } catch {
      // fallback to curated
    }
    const all = Object.values(THUMBNAIL_TEMPLATES);
    return all[Math.floor(Math.random() * all.length)] || null;
  }

  getRecommended() {
    if (this.recommendedTemplates.length > 0) return this.recommendedTemplates;
    return this.getCuratedRecommended();
  }

  getPopular() {
    if (this.popularTemplates.length > 0) return this.popularTemplates;
    return this.getCuratedPopular();
  }

  getCuratedRecommended() {
    return THUMBNAIL_TEMPLATES.filter((t) => t.tags.includes('high-ctr')).slice(0, 4);
  }

  getCuratedPopular() {
    return THUMBNAIL_TEMPLATES.filter((t) => t.tags.includes('popular')).slice(0, 4);
  }

  render() {
    if (this.selectedTemplateId) {
      const template = THUMBNAIL_TEMPLATES.find((t) => t.id === this.selectedTemplateId);
      if (template) {
        return `<div class="explore-ideas-container" style="--app-primary:${this.primary};--app-accent:${this.accent};--app-soft:${this.getSoft()};--app-soft-accent:${this.getSoftAccent()}">
          ${this.renderConfigurator(template)}
        </div>`;
      }
      this.selectedTemplateId = null;
    }

    const recommended = this.getRecommended();
    const popular = this.getPopular();
    const filtered = this.getFilteredTemplates();

    return `<div class="explore-ideas-container" style="--app-primary:${this.primary};--app-accent:${this.accent};--app-soft:${this.getSoft()};--app-soft-accent:${this.getSoftAccent()}" role="region" aria-label="Explore Ideas">
      <div class="explore-header">
        <div class="explore-title-row">
          <h2 class="explore-title">Explore Ideas</h2>
          ${this.onBack ? `<button type="button" class="explore-back-btn" data-action="back" aria-label="Back to thumbnail flow">← Back</button>` : ''}
        </div>
        <p class="explore-subtitle">Choose a template to start creating your thumbnail</p>
      </div>

      <div class="explore-search-section">
        ${new ThumbnailSearch({
          appColors: this.appColors,
          onSearch: (query) => {
            this.searchQuery = query;
            this.rerender();
          },
        }).render()}
      </div>

      <div class="explore-filter-section">
        ${new ThumbnailCategoryFilter({
          appColors: this.appColors,
          categories: this.categories,
          activeCategory: this.activeCategory,
          onSelectCategory: (cat) => {
            this.activeCategory = cat;
            this.rerender();
          },
        }).render()}
      </div>

      <div class="explore-sections">
        ${recommended.length > 0 && !this.searchQuery && this.activeCategory === 'all' ? `
          <section class="explore-section" aria-labelledby="section-recommended">
            <h3 id="section-recommended" class="explore-section-title">Recommended for You</h3>
            <div class="explore-section-grid">
              ${recommended.map((t) => new ThumbnailTemplateCard({ template: t, appColors: this.appColors, onSelect: () => this.selectTemplate(t.id) }).render()).join('')}
            </div>
          </section>
        ` : ''}

        ${popular.length > 0 && !this.searchQuery && this.activeCategory === 'all' ? `
          <section class="explore-section" aria-labelledby="section-popular">
            <h3 id="section-popular" class="explore-section-title">Popular Ideas</h3>
            <div class="explore-section-grid">
              ${popular.map((t) => new ThumbnailTemplateCard({ template: t, appColors: this.appColors, onSelect: () => this.selectTemplate(t.id) }).render()).join('')}
            </div>
          </section>
        ` : ''}

        ${filtered.length > 0 ? `
          <section class="explore-section" aria-labelledby="section-all">
            <h3 id="section-all" class="explore-section-title">
              ${this.searchQuery ? 'Search Results' : this.activeCategory !== 'all' ? this.activeCategory.charAt(0).toUpperCase() + this.activeCategory.slice(1) : 'Explore All'}
            </h3>
            ${new ThumbnailTemplateGrid({
              templates: filtered,
              appColors: this.appColors,
              onSelect: (id) => this.selectTemplate(id),
            }).render()}
          </section>
        ` : ''}

        ${filtered.length === 0 && !recommended.length && !popular.length ? `
          <div class="explore-empty" role="status">
            <p>No templates found. Try a different search or category.</p>
          </div>
        ` : ''}
      </div>
    </div>`;
  }

  getFilteredTemplates() {
    let result = THUMBNAIL_TEMPLATES;
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          t.category.toLowerCase().includes(q)
      );
    }
    if (this.activeCategory !== 'all') {
      if (this.activeCategory === 'recommended') {
        result = result.filter((t) => t.tags.includes('high-ctr'));
      } else if (this.activeCategory === 'popular') {
        result = result.filter((t) => t.tags.includes('popular'));
      } else {
        result = result.filter((t) => t.category === this.activeCategory);
      }
    }
    return result;
  }

  selectTemplate(id) {
    const template = THUMBNAIL_TEMPLATES.find((t) => t.id === id);
    if (this.onTemplateSelect && template) {
      this.onTemplateSelect(template);
      return;
    }
    this.selectedTemplateId = id;
    this.rerender();
  }

  renderConfigurator(template) {
    return new ThumbnailConfigurator({
      template,
      appColors: this.appColors,
      onBack: () => {
        this.selectedTemplateId = null;
        this.rerender();
      },
      onGenerate: (config) => {
        this.onSelectTemplate({ template, config });
      },
    }).render();
  }

  rerender() {
    const container = document.querySelector('.explore-ideas-container');
    if (container) {
      container.outerHTML = this.render();
      this.attachListeners();
    }
  }

  attachListeners() {
    const container = document.querySelector('.explore-ideas-container');
    if (!container) return;
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      if (action === 'back' && this.onBack) {
        this.onBack();
      }
    });
  }
}

export default ThumbnailExploreIdeas;
