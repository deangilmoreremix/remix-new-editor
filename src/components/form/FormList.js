import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';
import FormTextField from './FormTextField.js';

export default class FormList extends Component {
  constructor(options = {}) {
    super(options);
    this.label = options.label || '';
    this.onChange = options.onChange || (() => {});
    this.values = options.values || [];
    this.newValue = '';
  }

  handleNewValueChange = (value) => {
    this.newValue = value;
    this.update();
  };

  handleEnter = (value) => {
    const trimmedValue = value.trim();
    if (trimmedValue && !this.values.some(item => item === trimmedValue)) {
      this.values = [...this.values, trimmedValue];
      this.onChange(this.values);
    }
    this.newValue = '';
    this.update();
  };

  handleRemove = (value) => {
    this.values = this.values.filter(item => item !== value);
    this.onChange(this.values);
    this.update();
  };

  render() {
    const listItems = this.values.map(item => `
      <li class="form-list-item">
        <span class="item-text">${item}</span>
        <button type="button" class="remove-btn" onclick="this.handleRemove('${item}')">×</button>
      </li>
    `).join('');

    const formTextField = new FormTextField({
      value: this.newValue,
      onEnter: this.handleEnter,
      onChange: this.handleNewValueChange,
      placeholder: 'Add new item...'
    });

    const html = `
      <div class="form-group">
        ${this.label ? `<label class="form-control-label">${this.label}</label>` : ''}
        <div class="form-list-container">
          ${this.values.length > 0 ? `
            <ul class="form-list">
              ${listItems}
            </ul>
          ` : ''}
          <div class="add-item-container">
            ${formTextField.render().outerHTML}
          </div>
        </div>
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    // Re-render when values change
    if (this.element) {
      // This would trigger a re-render in a real implementation
    }
  }

  mount(element) {
    super.mount(element);
    this.element.handleNewValueChange = this.handleNewValueChange.bind(this);
    this.element.handleEnter = this.handleEnter.bind(this);
    this.element.handleRemove = this.handleRemove.bind(this);
  }
}