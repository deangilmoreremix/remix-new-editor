import { Component } from '../../../base/Component.js';

export class AccountField extends Component {
  constructor(props = {}) {
    super(props);

    this.state = {
      item: props.item,
      value: props.value,
      variableField: props.variableField || false,
      onChange: props.onChange,
      maxSymbols: props.maxSymbols,
    };
  }

  render() {
    const { item, value, variableField, onChange, maxSymbols } = this.state;

    const extraProps = item.onClick ? `onclick="${item.onClick.name}()"` : '';

    const inputValue = value !== undefined ? value : item?.input;

    const html = `
      <div class="user-panel__data-field">
        <span class="user-panel__data-field-label">${item.label}</span>
        <input
          type="text"
          value="${inputValue}"
          onchange="${onChange ? onChange.name : ''}"
          readonly="${!variableField}"
          class="user-panel__data-field-input"
          max="${maxSymbols || ''}"
        />
        ${item.link ? `<button class="user-panel__data-field-link" ${extraProps}>${item.link}</button>` : '<div class="user-panel__data-field-dummy"></div>'}
      </div>
    `;

    return this.createElementFromHTML(html);
  }
}
