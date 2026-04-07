import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class LibraryCTA extends Component {
  constructor(options = {}) {
    super(options);
    this.className = options.className || '';
    this.onSelect = options.onSelect || (() => {});
    this.items = options.items || [];
    this.page = 1;
    this.hasMore = true;
    this.loading = false;
  }

  handleSelect = (item) => {
    this.onSelect(item);
  };

  loadMore = () => {
    if (this.hasMore && !this.loading) {
      this.page++;
      // In a real implementation, this would fetch more items from an API
      // For now, we'll just mark as having no more
      this.hasMore = false;
      this.update();
    }
  };

  render() {
    const itemsHtml = this.items.map(item => `
      <div class="library-cta-item" style="background-image: url(${item.thumbnail})">
        <button class="btn-add" onclick="${this.handleSelect.name}(${JSON.stringify(item).replace(/"/g, '&quot;')})">+</button>
        <span class="title">${item.title}</span>
      </div>
    `).join('');

    const loadMoreButton = this.hasMore ? `
      <button class="load-more-btn" onclick="${this.loadMore.name}">Load More</button>
    ` : '';

    const html = `
      <div class="${this.className}">
        ${itemsHtml}
        ${loadMoreButton}
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    // Re-render when items change
    if (this.element && this.items.length > 0) {
      // This would trigger a re-render in a real implementation
    }
  }

  setItems(items) {
    this.items = items;
    this.update();
  }

  mount(element) {
    super.mount(element);
    // Add intersection observer for infinite scroll
    if ('IntersectionObserver' in window) {
      const loadMoreBtn = this.element.querySelector('.load-more-btn');
      if (loadMoreBtn) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.loadMore();
            }
          });
        });
        observer.observe(loadMoreBtn);
      }
    }
  }
}