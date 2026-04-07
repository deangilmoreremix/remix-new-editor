import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class RadioFormGroup extends Component {
  constructor(options = {}) {
    super(options);
    this.name = options.name || '';
    this.label = options.label || '';
    this.valueHolder = options.valueHolder || { value: '', error: '' };
    this.list = options.list || [];
    this.hint = options.hint || '';
    this.handler = options.handler || (() => {});
  }

  handleChange = (event) => {
    const { value } = event.target;
    this.handler({ ...this.valueHolder, value }, this.name);
    this.valueHolder.value = value;
    this.update();
  };

  render() {
    const hasError = this.valueHolder.error;
    const radioId = `radio-${this.name}`;

    const radiosHtml = this.list.map((item, index) => {
      const key = typeof item === 'object' ? item.key : item;
      const value = typeof item === 'object' ? item.value : item;
      const checked = this.valueHolder.value === key ? 'checked' : '';
      const itemId = `${radioId}-${index}`;

      return `
        <div class="form-check">
          <input
            class="form-check-input"
            type="radio"
            name="${this.name}"
            id="${itemId}"
            value="${key}"
            ${checked}
            onchange="${this.handleChange.name}"
          />
          <label class="form-check-label" for="${itemId}">
            ${value}
          </label>
        </div>
      `;
    }).join('');

    const html = `
      <div class="form-group ${hasError ? 'has-error' : ''}">
        ${this.label ? `<label class="${hasError ? 'error' : ''}">${this.label}</label>` : ''}
        ${this.hint ? `<small class="form-text text-muted">${this.hint}</small>` : ''}
        <div class="radio-group">
          ${radiosHtml}
        </div>
        ${hasError ? `<div class="error-message">${this.valueHolder.error}</div>` : ''}
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    if (this.element) {
      const radios = this.element.querySelectorAll('input[type="radio"]');
      const errorDiv = this.element.querySelector('.error-message');
      const label = this.element.querySelector('label');

      radios.forEach(radio => {
        radio.checked = radio.value === this.valueHolder.value;
      });

      if (errorDiv) {
        errorDiv.textContent = this.valueHolder.error || '';
      }

      if (label) {
        label.classList.toggle('error', !!this.valueHolder.error);
      }

      this.element.classList.toggle('has-error', !!this.valueHolder.error);
    }
  }

  mount(element) {
    super.mount(element);
    const radios = this.element.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => {
      radio.addEventListener('change', this.handleChange);
    });
  }

  unmount() {
    const radios = this.element?.querySelectorAll('input[type="radio"]');
    if (radios) {
      radios.forEach(radio => {
        radio.removeEventListener('change', this.handleChange);
      });
    }
    super.unmount();
  }
}