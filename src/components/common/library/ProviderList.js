import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class ProviderList extends Component {
  constructor(options = {}) {
    super(options);
    this.list = options.list || {};
    this.activeItem = options.activeItem || '';
    this.userContentTitle = options.userContentTitle || '';
    this.handleButtonClick = options.handleButtonClick || (() => {});
    this.activeTab = options.activeTab || '';
  }

  handleButtonClickInternal = (element) => {
    this.handleButtonClick(element);
  };

  render() {
    const isEnabledAddUrl = this.activeTab === 'VIDEO'; // Simplified condition

    const addUrlButton = isEnabledAddUrl ? `
      <button class="library__block--import" onclick="${this.handleButtonClickInternal.name}('add-url')">
        <span class="import-icon">📎</span>
        <p>Import from URL</p>
      </button>
    ` : '';

    const providerButtons = Object.keys(this.list).map(element => {
      const provider = this.list[element];
      const isActive = this.activeItem === element;
      const isUserContent = element === 'USER';

      return `
        <button
          type="button"
          class="library__btn-item ${isActive ? 'library__btn-active' : ''} ${isUserContent ? 'library__btn-user' : ''}"
          onclick="${this.handleButtonClickInternal.name}('${element}')"
        >
          ${provider.icon ? `<span class="library__icon-btn">${provider.icon}</span>` : ''}
          <p>
            ${isUserContent ? `${provider.name} ${this.userContentTitle}` : provider.name}
          </p>
        </button>
      `;
    }).join('');

    const html = `
      <div class="library__block-sidebar">
        <div class="library__btn-container">
          ${addUrlButton}
          ${providerButtons}
        </div>
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    // Update active states if needed
    if (this.element) {
      const buttons = this.element.querySelectorAll('.library__btn-item');
      buttons.forEach(button => {
        const isActive = button.onclick.toString().includes(this.activeItem);
        button.classList.toggle('library__btn-active', isActive);
      });
    }
  }

  mount(element) {
    super.mount(element);
    const buttons = this.element.querySelectorAll('button');
    buttons.forEach(button => {
      // The onclick attributes are handled by the HTML, but we could add additional listeners here if needed
    });
  }
}