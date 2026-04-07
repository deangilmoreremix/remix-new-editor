import { Component } from '../base/Component.js';
import { getStore } from '../base/Store.js';

export class FormSelect extends Component {
  constructor(props = {}) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(event) {
    const value = event.target.value;
    if (this.props.onChange) {
      this.props.onChange(value);
    }
  }

  render() {
    const { items = [], label, value, className, disabled } = this.props;
    const options = items.map(item => `<option value="${item.value}">${item.label}</option>`).join('');
    const selectClass = `form-select ${className || ''}`;
    const html = `
      <div class="form-group">
        ${label ? `<label>${label}</label>` : ''}
        <select class="${selectClass}" ${disabled ? 'disabled' : ''} value="${value || ''}">${options}</select>
      </div>
    `;
    const element = this.createElementFromHTML(html);
    const select = element.querySelector('select');
    this.addEventListener(select, 'change', this.handleChange);
    return element;
  }
}