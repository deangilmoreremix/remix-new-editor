import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class RatioList extends Component {
  constructor(options = {}) {
    super(options);
    this.onChangeRatio = options.onChangeRatio || (() => {});
    this.canvasSizes = options.canvasSizes || [
      { width: 1920, height: 1080 },
      { width: 1080, height: 1920 },
      { width: 1080, height: 1080 },
      { width: 1280, height: 720 },
      { width: 720, height: 1280 }
    ];
    this.activeElement = 'All ratios';
    this.showDropdown = false;
  }

  handleToggle = () => {
    this.showDropdown = !this.showDropdown;
    this.update();
  };

  handleItemClick = (value) => {
    if (value) {
      this.activeElement = `${value.width}/${value.height}`;
      this.onChangeRatio(value);
    } else {
      this.activeElement = 'All ratios';
      this.onChangeRatio(null);
    }
    this.showDropdown = false;
    this.update();
  };

  render() {
    const allRatiosItem = { title: 'All ratios', value: null };
    const sizeItems = this.canvasSizes.map(size => ({
      title: `${size.width}/${size.height}`,
      value: size
    }));

    const dropdownItems = [allRatiosItem, ...sizeItems]
      .filter(item => item.title !== this.activeElement)
      .map(item => `
        <div class="dropdown-item" onclick="this.handleItemClick(${item.value ? JSON.stringify(item.value).replace(/"/g, '&quot;') : 'null'})">
          ${item.title}
        </div>
      `).join('');

    const html = `
      <div class="ratio-list">
        <div class="ratio-selector" onclick="this.handleToggle()">
          <span class="ratio-title">${this.activeElement}</span>
          <span class="dropdown-arrow ${this.showDropdown ? 'open' : ''}">▼</span>
        </div>
        ${this.showDropdown ? `
          <div class="ratio-dropdown">
            ${dropdownItems}
          </div>
        ` : ''}
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    // Update dropdown visibility
    if (this.element) {
      const dropdown = this.element.querySelector('.ratio-dropdown');
      if (dropdown) {
        dropdown.style.display = this.showDropdown ? 'block' : 'none';
      }
    }
  }

  mount(element) {
    super.mount(element);
    this.element.handleToggle = this.handleToggle.bind(this);
    this.element.handleItemClick = this.handleItemClick.bind(this);
  }
}