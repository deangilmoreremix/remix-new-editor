import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class Categories extends Component {
  constructor(options = {}) {
    super(options);
    this.list = options.list || { init: false, items: [], activeItem: null };
    this.dispatchList = options.dispatchList || (() => {});
    this.select = options.select || (() => {});
    this.className = options.className || '';
  }

  handleCategorySelect = () => {
    this.select();
  };

  render() {
    if (!this.list.init) {
      return document.createElement('div'); // Return empty div if not initialized
    }

    const categoryItems = (this.list.items || []).map(item => `
      <div class="category-item" onclick="this.handleCategorySelect()">
        ${item.name || item.title || item}
      </div>
    `).join('');

    const html = `
      <div class="${this.className}">
        <div class="categories-header first-title">Browse templates</div>
        <button
          class="categories-subheader second-title ${!this.list.activeItem ? 'active-category' : ''}"
          onclick="this.handleCategorySelect()"
        >
          All templates
        </button>
        <div class="categories-list">
          <div class="library__items">
            ${categoryItems}
          </div>
        </div>
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    // Update when list changes
    if (this.element) {
      // This would trigger a re-render in a real implementation
    }
  }

  mount(element) {
    super.mount(element);
    this.element.handleCategorySelect = this.handleCategorySelect.bind(this);
  }
}