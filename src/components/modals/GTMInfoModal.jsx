import { BaseModal } from './BaseModal.jsx';
import { gtmContentLibrary } from '../../lib/gtmContentLibrary.js';
import { openaiConfig } from '../../lib/config/openaiConfig.js';

const RECOMMENDED_COMBOS = [
  {
    label: 'Cold Outreach Starter',
    values: { role: 'sdr', industry: 'saas', methodology: 'challenger', tonality: 'conversational' }
  },
  {
    label: 'Enterprise Demo',
    values: { role: 'ae', industry: 'saas', methodology: 'meddpicc', tonality: 'professional' }
  },
  {
    label: 'Social Launch',
    values: { role: 'sdr', industry: 'ecommerce', methodology: 'challenger', tonality: 'casual' }
  },
  {
    label: 'Customer Story',
    values: { role: 'customer-success', industry: 'saas', methodology: 'spin', tonality: 'empathetic' }
  },
  {
    label: 'Executive Vision',
    values: { role: 'executive', industry: 'technology', methodology: 'challenger', tonality: 'executive' }
  },
  {
    label: 'Bottom-Funnel Conversion',
    values: { role: 'ae', industry: 'fintech', methodology: 'value-selling', tonality: 'direct' }
  }
];

const SECTION_ORDER = [
  { key: 'role', title: 'Target Role', renderer: 'renderRoleOptions' },
  { key: 'industry', title: 'Industry', renderer: 'renderIndustryOptions' },
  { key: 'methodology', title: 'Sales Methodology', renderer: 'renderMethodologyOptions' },
  { key: 'tonality', title: 'Writing Style', renderer: 'renderTonalityOptions' },
  { key: 'model', title: 'Model', renderer: 'renderModelOptions' },
  { key: 'focus', title: 'Conversion Focus', renderer: 'renderFocusOptions' },
  { key: 'cinematic', title: 'Cinematic Enhancement Elements', renderer: 'renderCinematicOptions' }
];

const DIFFICULTY_COLORS = {
  Easy: '#10b981',
  Medium: '#f59e0b',
  Hard: '#ef4444'
};

export class GTMInfoModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Understanding GTM Boost Options',
      size: 'large',
      showFooter: true,
      ...options
    });

    this.footerContent = options.footerContent || `
      <button class="modal-btn modal-btn-secondary" data-action="close">Close</button>
    `;

    this.appTheme = options.appTheme || 'timeline-editor';
    this.appColors = this.getAppColorScheme(this.appTheme);
    this.searchQuery = '';
    this.expandedSections = new Set();
    this.allExpanded = false;
    this.sectionData = [];
    this.lazyRendered = new Set();
    this.prefersReducedMotion = false;
  }

  getAppColorScheme(theme) {
    const scheme = openaiConfig.getStudioColorScheme(theme);
    if (theme === 'timeline-editor') return scheme;
    if (theme && !openaiConfig.getAllStudioColorSchemes()[theme]) {
      return openaiConfig.getStudioColorScheme('timeline-editor');
    }
    return scheme;
  }

  hexToRgba(hex, alpha) {
    if (typeof hex !== 'string') return `rgba(217, 255, 0, ${alpha})`;
    const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return `rgba(217, 255, 0, ${alpha})`;
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  getSectionData() {
    if (this.sectionData.length) return this.sectionData;
    this.sectionData = SECTION_ORDER.map((section) => {
      let items = [];
      switch (section.key) {
        case 'role':
          items = gtmContentLibrary.getRoleOptions().map((o) => ({ ...o, description: gtmContentLibrary.getRoleDescription(o.value) || '' }));
          break;
        case 'industry':
          items = gtmContentLibrary.getIndustryOptions().map((o) => ({ ...o, description: gtmContentLibrary.getIndustryDescription(o.value) || '' }));
          break;
        case 'methodology':
          items = gtmContentLibrary.getMethodologyOptions().map((o) => ({ ...o, description: gtmContentLibrary.getMethodologyDescription(o.value) || '' }));
          break;
        case 'tonality':
          items = gtmContentLibrary.getTonalityOptions().map((o) => ({ ...o, description: gtmContentLibrary.getTonalityDescription(o.value) || '' }));
          break;
        case 'model':
          items = gtmContentLibrary.getModelOptions().map((o) => ({ ...o, description: o.description || '' }));
          break;
        case 'focus':
          items = gtmContentLibrary.getFocusAreaOptions().map((o) => ({ ...o, description: gtmContentLibrary.getFocusAreaDescription(o.value) || '' }));
          break;
        case 'cinematic':
          items = gtmContentLibrary.getCinematicElementOptions().map((o) => ({ ...o, description: o.description || '' }));
          break;
        default:
          break;
      }
      return { ...section, items };
    });
    return this.sectionData;
  }

  getFilteredSections() {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return this.getSectionData();
    const filtered = this.getSectionData()
      .map((section) => {
        const filteredItems = section.items.filter((item) => {
          const haystack = `${item.label} ${item.description} ${item.bestFor || ''} ${item.example || ''}`.toLowerCase();
          return haystack.includes(query);
        });
        return { ...section, items: filteredItems };
      })
      .filter((section) => section.items.length > 0 || section.title.toLowerCase().includes(query));

    if (filtered.length === 0) {
      return [
        {
          key: '__empty',
          title: 'Results',
          renderer: 'renderRoleOptions',
          items: [],
          isEmpty: true
        }
      ];
    }
    return filtered;
  }

  renderBody() {
    const sections = this.getFilteredSections();
    return `
      <div class="gtm-info-modal" style="--app-primary: ${this.appColors.primary}; --app-accent: ${this.appColors.accent}; --app-on-primary: ${this.appColors.onPrimary || '#000000'}; --app-soft: ${this.hexToRgba(this.appColors.primary, 0.12)}; --app-soft-accent: ${this.hexToRgba(this.appColors.accent, 0.12)}; --app-glow: ${this.hexToRgba(this.appColors.primary, 0.25)}">
        <div class="gtm-info-header">
          <p class="gtm-info-subtitle">GTM Boost combines sales methodology with cinematic storytelling to transform basic prompts into conversion-optimized video prompts. Use this guide to understand each option.</p>
          <div class="gtm-info-controls">
            <div class="gtm-info-search">
              <label for="gtm-info-search" class="sr-only">Search options</label>
              <input
                id="gtm-info-search"
                type="search"
                class="gtm-info-search-input"
                placeholder="Search options..."
                value="${this.escapeHtml(this.searchQuery)}"
                data-action="gtm-info-search"
                autocomplete="off"
              />
            </div>
            <div class="gtm-info-actions">
              <button type="button" class="gtm-info-action-btn" data-action="gtm-expand-all">Expand all</button>
              <button type="button" class="gtm-info-action-btn" data-action="gtm-collapse-all">Collapse all</button>
            </div>
          </div>
        </div>
        <div class="gtm-info-sections" role="region" aria-live="polite" aria-label="GTM Boost options">
          ${sections.map((section) => this.renderSection(section)).join('')}
        </div>
        <div class="gtm-info-recommendations" aria-label="Recommended combinations">
          <div class="gtm-info-recommendations-title">Recommended Starting Combinations</div>
          <div class="gtm-info-recommendations-list">
            ${RECOMMENDED_COMBOS.map((combo) => `
              <button type="button" class="gtm-info-combo" data-action="gtm-combo" data-combo-label="${this.escapeHtml(combo.label)}">
                <span class="gtm-info-combo-label">${this.escapeHtml(combo.label)}</span>
                <span class="gtm-info-combo-meta">${Object.keys(combo.values).length} selections</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderSection(section) {
    if (section.isEmpty) {
      return `
        <div class="gtm-info-empty" role="status">
          <div class="gtm-info-empty-text">No matching options found.</div>
          <div class="gtm-info-empty-hint">Try a shorter search term.</div>
        </div>
      `;
    }
    const isOpen = this.expandedSections.has(section.key);
    const count = section.items.length;
    const sectionKey = section.key;
    return `
      <details class="gtm-info-section${isOpen ? ' open' : ''}" data-section="${sectionKey}" ${isOpen ? 'open' : ''}>
        <summary class="gtm-info-section-title">
          <span class="gtm-info-section-label">${this.escapeHtml(section.title)}</span>
          <span class="gtm-info-section-count" aria-label="${count} options">${count}</span>
        </summary>
        <div class="gtm-info-section-body" data-lazy="${sectionKey}">
          ${count === 0 ? this.renderEmptyState() : section.items.map((item) => this.renderOptionItem(item)).join('')}
        </div>
      </details>
    `;
  }

  renderEmptyState() {
    return `
      <div class="gtm-info-empty">
        <div class="gtm-info-empty-text">No matching options found.</div>
        <div class="gtm-info-empty-hint">Try a shorter search term.</div>
      </div>
    `;
  }

  renderOptionItem(item) {
    const difficultyColor = DIFFICULTY_COLORS[item.difficulty] || 'inherit';
    return `
      <div class="gtm-info-option">
        <div class="gtm-info-option-header">
          <div class="gtm-info-option-name">${this.escapeHtml(item.label)}</div>
          ${item.difficulty ? `<span class="gtm-info-option-difficulty" style="color: ${difficultyColor}">${this.escapeHtml(item.difficulty)}</span>` : ''}
        </div>
        <div class="gtm-info-option-desc">${this.escapeHtml(item.description || '')}</div>
        ${item.bestFor ? `<div class="gtm-info-option-bestfor"><span class="gtm-info-option-bestfor-label">Best for</span> ${this.escapeHtml(item.bestFor)}</div>` : ''}
        ${item.example ? `<div class="gtm-info-option-example"><span class="gtm-info-option-example-label">Example</span> ${this.escapeHtml(item.example)}</div>` : ''}
      </div>
    `;
  }

  renderFooter() {
    return this.footerContent || '';
  }

  refreshBody() {
    if (!this.overlay) return;
    const body = this.overlay.querySelector('.modal-body');
    if (body) body.innerHTML = this.renderBody();
    this.bindBodyListeners();
  }

  setupEventListeners() {
    super.setupEventListeners();

    const closeBtn = this.overlay.querySelector('[data-action="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const searchInput = this.overlay.querySelector('[data-action="gtm-info-search"]');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.refreshBody();
        if (searchInput.value) {
          searchInput.focus();
        }
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.searchQuery = '';
          searchInput.value = '';
          this.refreshBody();
        }
      });
    }

    const expandBtn = this.overlay.querySelector('[data-action="gtm-expand-all"]');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => this.setAllSectionsOpen(true));
    }

    const collapseBtn = this.overlay.querySelector('[data-action="gtm-collapse-all"]');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => this.setAllSectionsOpen(false));
    }

    this.overlay.querySelectorAll('[data-action="gtm-combo"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const label = btn.getAttribute('data-combo-label') || '';
        this.overlay.dispatchEvent(new CustomEvent('gtm-combo-selected', { detail: { label }, bubbles: true }));
      });
    });

    this.overlay.querySelectorAll('.gtm-info-section summary').forEach((summary) => {
      summary.addEventListener('click', () => {
        const details = summary.parentElement;
        const sectionKey = details.getAttribute('data-section');
        if (!sectionKey) return;
        const nextOpen = details.open;
        if (nextOpen) {
          this.expandedSections.add(sectionKey);
        } else {
          this.expandedSections.delete(sectionKey);
        }
      });
    });

    this.detectReducedMotion();
  }

  setAllSectionsOpen(open) {
    this.allExpanded = open;
    const sections = this.getFilteredSections();
    if (open) {
      sections.forEach((s) => this.expandedSections.add(s.key));
    } else {
      this.expandedSections.clear();
    }
    this.refreshBody();
  }

  detectReducedMotion() {
    try {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.prefersReducedMotion = mediaQuery.matches;
      mediaQuery.addEventListener?.('change', (e) => {
        this.prefersReducedMotion = e.matches;
      });
    } catch {
      this.prefersReducedMotion = false;
    }
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export function createGTMInfoModal(appTheme = 'timeline-editor') {
  return new GTMInfoModal({ appTheme });
}
