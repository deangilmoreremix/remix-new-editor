import Component from '../../../base/Component';

export class Basic extends Component {
  constructor(props = {}) {
    super(props);
    this.createField = this.createField.bind(this);
  }

  createField(key, field) {
    const { label, type, ...fieldProps } = field;
    const { options, element, ...props } = this.props;
    const container = document.createElement('div');
    container.className = 'field-wrapper';
    if (label) {
      const labelEl = document.createElement('label');
      labelEl.textContent = label;
      labelEl.setAttribute('for', key);
      container.appendChild(labelEl);
    }
    let input;
    if (type === 'dropButton') {
      input = document.createElement('input');
      input.type = 'file';
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          // Mock upload
          const url = 'uploaded-url';
          props.onChange({ [key]: url });
        }
      });
    } else {
      input = document.createElement('input');
      input.type = type || 'text';
      input.value = options[key] || '';
      input.name = key;
      input.id = key;
      input.addEventListener('change', (e) => {
        props.onChange({ [key]: e.target.value });
      });
    }
    container.appendChild(input);
    return container;
  }

  render() {
    const { fields } = this.props;
    const div = document.createElement('div');
    if (fields) {
      Object.keys(fields).forEach(key => {
        const field = this.createField(key, fields[key]);
        div.appendChild(field);
      });
    }
    return div;
  }
}

export default Basic;
