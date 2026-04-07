import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class Toggler extends Component {
  constructor(options = {}) {
    super(options);
    this.label = options.label || '';
    this.checked = options.checked || false;
    this.onChange = options.onChange || (() => {});
  }

  handleToggle = (event) => {
    this.checked = event.target.checked;
    this.onChange(this.checked);
    this.update();
  };

  render() {
    const html = `
      <div class="on-off-switch">
        ${this.label ? `<div class="on-off-switch-label">${this.label}</div>` : ''}
        <label class="on-off-switch-control">
          <span class="off-label">Off</span>
          <input
            type="checkbox"
            ${this.checked ? 'checked' : ''}
            onchange="${this.handleToggle.name}"
          />
          <span class="toggle-slider"></span>
          <span class="on-label">On</span>
        </label>
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    const toggle = this.element?.querySelector('input[type="checkbox"]');
    if (toggle) {
      toggle.checked = this.checked;
    }
  }

  mount(element) {
    super.mount(element);
    const toggle = this.element.querySelector('input[type="checkbox"]');
    if (toggle) {
      toggle.addEventListener('change', this.handleToggle);
    }
  }

  unmount() {
    const toggle = this.element?.querySelector('input[type="checkbox"]');
    if (toggle) {
      toggle.removeEventListener('change', this.handleToggle);
    }
    super.unmount();
  }
}