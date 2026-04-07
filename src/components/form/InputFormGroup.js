import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class InputFormGroup extends Component {
  constructor(options = {}) {
    super(options);
    this.name = options.name || '';
    this.label = options.label || '';
    this.placeholder = options.placeholder || this.label;
    this.valueHolder = options.valueHolder || { value: '', error: '' };
    this.inputType = options.inputType || 'text';
    this.step = options.step || undefined;
    this.disabled = options.disabled || false;
    this.hint = options.hint || '';
    this.required = options.required || false;
    this.minLength = options.minLength || undefined;
    this.patternOptions = options.patternOptions || {};
    this.handler = options.handler || (() => {});
    this.onKeyDown = options.onKeyDown || (() => {});
  }

  handleChange = (event) => {
    const { value } = event.target;
    const error = this.validate(value);
    this.handler({
      ...this.valueHolder,
      value,
      error,
    }, this.name);
    this.valueHolder.error = error;
    this.update();
  };

  handleKeyDown = (event) => {
    this.onKeyDown(event);
  };

  validate(value) {
    if (this.required && (!value || value.trim() === '')) {
      return 'This field is required';
    }

    if (this.minLength && value.length < this.minLength) {
      return `Minimum length is ${this.minLength} characters`;
    }

    if (this.patternOptions.pattern && !new RegExp(this.patternOptions.pattern).test(value)) {
      return this.patternOptions.message || 'Invalid format';
    }

    return '';
  }

  render() {
    const hasError = this.valueHolder.error;
    const inputId = `input-${this.name}`;

    const html = `
      <div class="form-group ${hasError ? 'has-error' : ''}">
        ${this.label ? `<label for="${inputId}" class="${hasError ? 'error' : ''}">${this.label}</label>` : ''}
        <input
          type="${this.inputType}"
          id="${inputId}"
          name="${this.name}"
          placeholder="${this.placeholder}"
          value="${this.valueHolder.value || ''}"
          ${this.step ? `step="${this.step}"` : ''}
          ${this.disabled ? 'disabled' : ''}
          onchange="${this.handleChange.name}"
          onkeydown="${this.handleKeyDown.name}"
          class="form-control ${hasError ? 'error' : ''}"
        />
        ${hasError ? `<div class="error-message">${this.valueHolder.error}</div>` : ''}
        ${this.hint ? `<small class="form-text text-muted">${this.hint}</small>` : ''}
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    if (this.element) {
      const input = this.element.querySelector('input');
      const errorDiv = this.element.querySelector('.error-message');
      const label = this.element.querySelector('label');

      if (input) {
        input.value = this.valueHolder.value || '';
        input.classList.toggle('error', !!this.valueHolder.error);
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
    const input = this.element.querySelector('input');
    if (input) {
      input.addEventListener('input', this.handleChange);
      input.addEventListener('keydown', this.handleKeyDown);
    }
  }

  unmount() {
    const input = this.element?.querySelector('input');
    if (input) {
      input.removeEventListener('input', this.handleChange);
      input.removeEventListener('keydown', this.handleKeyDown);
    }
    super.unmount();
  }
}