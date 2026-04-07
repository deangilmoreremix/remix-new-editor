import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class Tabs extends Component {
  constructor(options = {}) {
    super(options);
    this.tabs = options.tabs || [];
    this.activeTab = options.activeTab || '';
    this.onTabChange = options.onTabChange || (() => {});
  }

  handleTabClick = (tabId) => {
    this.activeTab = tabId;
    this.onTabChange(tabId);
    this.update();
  };

  render() {
    const tabsHtml = this.tabs.map(tab => {
      const isActive = this.activeTab === tab.id;
      return `
        <button
          type="button"
          class="tab-button ${isActive ? 'active' : ''}"
          data-tab="${tab.id}"
          onclick="${this.handleTabClick.name}('${tab.id}')"
        >
          ${tab.icon ? `<span class="tab-icon">${tab.icon}</span>` : ''}
          <span class="tab-label">${tab.label}</span>
        </button>
      `;
    }).join('');

    const html = `
      <div class="tabs-container">
        <div class="tabs">
          ${tabsHtml}
        </div>
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    if (this.element) {
      const buttons = this.element.querySelectorAll('.tab-button');
      buttons.forEach(button => {
        const tabId = button.dataset.tab;
        const isActive = this.activeTab === tabId;
        button.classList.toggle('active', isActive);
      });
    }
  }

  setActiveTab(tabId) {
    this.activeTab = tabId;
    this.update();
  }

  mount(element) {
    super.mount(element);
    const buttons = this.element.querySelectorAll('.tab-button');
    buttons.forEach(button => {
      const tabId = button.dataset.tab;
      button.addEventListener('click', () => this.handleTabClick(tabId));
    });
  }

  unmount() {
    const buttons = this.element?.querySelectorAll('.tab-button');
    if (buttons) {
      buttons.forEach(button => {
        const tabId = button.dataset.tab;
        button.removeEventListener('click', () => this.handleTabClick(tabId));
      });
    }
    super.unmount();
  }
}