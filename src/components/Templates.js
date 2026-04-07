import Component from './base/Component.js';
import { createElementFromHTML } from '../utils/jsx.js';

export default class Templates extends Component {
  constructor(options = {}) {
    super(options);
    this.templates = options.templates || [];
    this.categories = options.categories || [];
    this.selectedCategory = options.selectedCategory || '';
    this.searchQuery = options.searchQuery || '';
    this.onTemplateSelect = options.onTemplateSelect || (() => {});
    this.onCategoryChange = options.onCategoryChange || (() => {});
  }

  handleTemplateSelect = (template) => {
    this.onTemplateSelect(template);
  };

  handleCategoryChange = (categoryId) => {
    this.selectedCategory = categoryId;
    this.onCategoryChange(categoryId);
    this.update();
  };

  handleSearchChange = (event) => {
    this.searchQuery = event.target.value;
    this.update();
  };

  getFilteredTemplates() {
    let filtered = this.templates;

    if (this.selectedCategory) {
      filtered = filtered.filter(template => template.category === this.selectedCategory);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }

    return filtered;
  }

  render() {
    const filteredTemplates = this.getFilteredTemplates();

    const categoriesHtml = this.categories.map(category => `
      <button
        class="category-btn ${this.selectedCategory === category.id ? 'active' : ''}"
        onclick="this.handleCategoryChange('${category.id}')"
      >
        ${category.name}
      </button>
    `).join('');

    const templatesHtml = filteredTemplates.map(template => `
      <div class="template-card" onclick="this.handleTemplateSelect(${JSON.stringify(template).replace(/"/g, '&quot;')})">
        <div class="template-preview" style="background-image: url(${template.thumbnail || '/static/images/template-placeholder.png'})">
          <div class="template-overlay">
            <span class="template-name">${template.name}</span>
            <span class="template-duration">${template.duration}s</span>
          </div>
        </div>
        <div class="template-info">
          <h4>${template.name}</h4>
          <p>${template.description || 'Professional video template'}</p>
        </div>
      </div>
    `).join('');

    const html = `
      <div class="templates-container">
        <div class="templates-header">
          <h2>Choose a Template</h2>
          <div class="search-container">
            <input
              type="text"
              placeholder="Search templates..."
              value="${this.searchQuery}"
              onchange="this.handleSearchChange(event)"
              class="search-input"
            />
          </div>
        </div>

        <div class="categories-section">
          <div class="categories-list">
            <button
              class="category-btn ${!this.selectedCategory ? 'active' : ''}"
              onclick="this.handleCategoryChange('')"
            >
              All Templates
            </button>
            ${categoriesHtml}
          </div>
        </div>

        <div class="templates-grid">
          ${templatesHtml}
        </div>

        ${filteredTemplates.length === 0 ? `
          <div class="no-templates">
            <p>No templates found matching your criteria.</p>
          </div>
        ` : ''}
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    // Re-render when filters change
    if (this.element) {
      // This would trigger a re-render in a real implementation
    }
  }

  setTemplates(templates) {
    this.templates = templates;
    this.update();
  }

  setCategories(categories) {
    this.categories = categories;
    this.update();
  }

  mount(element) {
    super.mount(element);
    this.element.handleTemplateSelect = this.handleTemplateSelect.bind(this);
    this.element.handleCategoryChange = this.handleCategoryChange.bind(this);
    this.element.handleSearchChange = this.handleSearchChange.bind(this);
  }
}