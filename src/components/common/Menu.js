import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class Menu extends Component {
  constructor(options = {}) {
    super(options);
    this.toggleElement = options.toggleElement || 'Menu';
    this.items = options.items || [];
    this.className = options.className || '';
    this.needEndIcon = options.needEndIcon || false;
    this.parent = options.parent || null;
    this.placement = options.placement || 'bottom-start';
    this.useButton = options.useButton || false;
    this.onClick = options.onClick || (() => {});
    this.lineDropIcon = options.lineDropIcon || false;
    this.open = false;
  }

  handleToggle = () => {
    this.open = !this.open;
    this.update();
  };

  handleItemClick = (item) => {
    this.onClick(item.value || item);
    this.open = false;
    this.update();
  };

  handleClickAway = (event) => {
    if (this.element && !this.element.contains(event.target)) {
      this.open = false;
      this.update();
    }
  };

  render() {
    const menuItems = this.items.map(item => `
      <div class="menu-item" onclick="this.handleItemClick(${JSON.stringify(item).replace(/"/g, '&quot;')})">
        <span class="menu-item-title">${item.title || item}</span>
        ${this.needEndIcon ? '<span class="menu-item-icon">▶</span>' : ''}
      </div>
    `).join('');

    const toggleContent = typeof this.toggleElement === 'string'
      ? `<span>${this.toggleElement}</span>`
      : this.toggleElement;

    const html = `
      <div class="menu-container ${this.className}" onclick="this.handleToggle()">
        <div class="menu-toggle">
          ${toggleContent}
          <span class="menu-arrow ${this.open ? 'open' : ''}">${this.lineDropIcon ? '━' : '▼'}</span>
        </div>
        ${this.open ? `
          <div class="menu-dropdown">
            ${menuItems}
          </div>
        ` : ''}
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    if (this.element) {
      const dropdown = this.element.querySelector('.menu-dropdown');
      if (dropdown) {
        dropdown.style.display = this.open ? 'block' : 'none';
      }
    }
  }

  mount(element) {
    super.mount(element);
    this.element.handleToggle = this.handleToggle.bind(this);
    this.element.handleItemClick = this.handleItemClick.bind(this);

    // Add click away listener
    document.addEventListener('click', this.handleClickAway);
  }

  unmount() {
    document.removeEventListener('click', this.handleClickAway);
    super.unmount();
  }
}