import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class Loader extends Component {
  constructor(options = {}) {
    super(options);
    this.className = options.className || '';
    this.isLoading = options.isLoading || false;
    this.size = options.size || 100;
    this.color = options.color || '#EB5054';
    this.fixed = options.fixed || false;
    this.preloader = options.preloader || false;
  }

  render() {
    const html = `
      <div class="loading-spinner ${this.className} ${this.fixed ? 'fixed' : ''} ${this.isLoading ? 'active' : ''} ${this.preloader ? 'preloader' : ''}"
           style="display: ${this.isLoading ? 'block' : 'none'}">
        <div class="spinner"
             style="width: ${this.size}px; height: ${this.size}px; border-color: ${this.color}; border-top-color: transparent;">
        </div>
      </div>
    `;

    return createElementFromHTML(html);
  }

  show() {
    this.isLoading = true;
    this.update();
  }

  hide() {
    this.isLoading = false;
    this.update();
  }

  update() {
    if (this.element) {
      this.element.style.display = this.isLoading ? 'block' : 'none';
      this.element.classList.toggle('active', this.isLoading);
    }
  }
}