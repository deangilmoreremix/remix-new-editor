import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class FormTextField extends Component {
  constructor(options = {}) {
    super(options);
    this.id = options.id || '';
    this.type = options.type || 'text';
    this.mask = options.mask || '';
    this.label = options.label || '';
    this.name = options.name || '';
    this.onChange = options.onChange || (() => {});
    this.onEnter = options.onEnter || (() => {});
    this.onBlur = options.onBlur || (() => {});
    this.disabled = options.disabled || false;
    this.inputClassName = options.inputClassName || '';
    this.labelClassName = options.labelClassName || '';
    this.className = options.className || '';
    this.placeholder = options.placeholder || '';
    this.value = options.value || '';
    this.multiline = options.multiline || false;
    this.rowsMin = options.rowsMin || 1;
    this.rowsMax = options.rowsMax || 4;
    this.readOnly = options.readOnly || false;
    this.labelHint = options.labelHint || '';
    this.error = options.error || false;
    this.helperText = options.helperText || '';
  }

  handleChange = (event) => {
    this.value = event.target.value;
    this.onChange(this.value);
  };

  handleKeyPress = (event) => {
    if (event.key === 'Enter' && this.onEnter) {
      this.onEnter(this.value);
    }
  };

  handleBlur = (event) => {
    this.onBlur(this.value);
  };

  render() {
    const inputId = this.id || `input-${this.name}`;
    const inputElement = this.multiline ? 'textarea' : 'input';

    const html = `
      <div class="form-group ${this.className} ${this.error ? 'has-error' : ''}">
        ${this.label ? `
          <label for="${inputId}" class="form-label ${this.labelClassName}">
            ${this.label}
            ${this.labelHint ? `<small class="label-hint">${this.labelHint}</small>` : ''}
          </label>
        ` : ''}

        <${inputElement}
          type="${this.type}"
          id="${inputId}"
          name="${this.name}"
          value="${this.value}"
          placeholder="${this.placeholder}"
          ${this.disabled ? 'disabled' : ''}
          ${this.readOnly ? 'readonly' : ''}
          ${this.multiline ? `rows="${this.rowsMin}"` : ''}
          ${this.multiline && this.rowsMax ? `maxlength="${this.rowsMax * 50}"` : ''}
          class="form-control ${this.inputClassName} ${this.error ? 'error' : ''}"
          onchange="this.handleChange(event)"
          onkeypress="this.handleKeyPress(event)"
          onblur="this.handleBlur(event)"
        />

        ${this.helperText ? `<small class="form-text text-muted">${this.helperText}</small>` : ''}
        ${this.error ? `<div class="error-message">${this.error}</div>` : ''}
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    if (this.element) {
      const input = this.element.querySelector(this.multiline ? 'textarea' : 'input');
      if (input && input.value !== this.value) {
        input.value = this.value;
      }
    }
  }

  mount(element) {
    super.mount(element);
    this.element.handleChange = this.handleChange.bind(this);
    this.element.handleKeyPress = this.handleKeyPress.bind(this);
    this.element.handleBlur = this.handleBlur.bind(this);
  }

  focus() {
    const input = this.element?.querySelector(this.multiline ? 'textarea' : 'input');
    if (input) {
      input.focus();
    }
  }
}