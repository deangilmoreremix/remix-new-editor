import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class SelectFormGroup extends Component {
  constructor(options = {}) {
    super(options);
    this.name = options.name || '';
    this.label = options.label || '';
    this.valueHolder = options.valueHolder || { value: '', error: '' };
    this.list = options.list || [];
    this.placeholder = options.placeholder || this.label;
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
    const selectId = `select-${this.name}`;

    const optionsHtml = this.list.map(item => {
      const key = typeof item === 'object' ? item.key : item;
      const value = typeof item === 'object' ? item.value : item;
      const selected = this.valueHolder.value === key ? 'selected' : '';
      return `<option value="${key}" ${selected}>${value}</option>`;
    }).join('');

    const html = `
      <div class="form-group ${hasError ? 'has-error' : ''}">
        ${this.label ? `<label for="${selectId}" class="${hasError ? 'error' : ''}">${this.label}</label>` : ''}
        ${this.hint ? `<small class="form-text text-muted">${this.hint}</small>` : ''}
        <select
          id="${selectId}"
          name="${this.name}"
          onchange="${this.handleChange.name}"
          class="form-control ${hasError ? 'error' : ''}"
        >
          <option value="">${this.placeholder}</option>
          ${optionsHtml}
        </select>
        ${hasError ? `<div class="error-message">${this.valueHolder.error}</div>` : ''}
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    if (this.element) {
      const select = this.element.querySelector('select');
      const errorDiv = this.element.querySelector('.error-message');
      const label = this.element.querySelector('label');

      if (select) {
        select.value = this.valueHolder.value || '';
        select.classList.toggle('error', !!this.valueHolder.error);
      }

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
    const select = this.element.querySelector('select');
    if (select) {
      select.addEventListener('change', this.handleChange);
    }
  }

  unmount() {
    const select = this.element?.querySelector('select');
    if (select) {
      select.removeEventListener('change', this.handleChange);
    }
    super.unmount();
  }
}