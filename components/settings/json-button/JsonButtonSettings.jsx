import Component from '../../base/Component';
import mediaConstants from '../../../lib/constants/media';
import * as constant from '../../../lib/constants/popcorn';

export class JsonButtonSettings extends Component {
  constructor(props = {}) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.createField = this.createField.bind(this);
  }

  handleChange(field) {
    this.props.update(field);
  }

  createField(key, field, options) {
    const { label, type, featureLabels } = field;
    const { store } = this.props;
    const { isfeatureEnabled } = store || {};
    let newLabel = null;
    if (featureLabels) {
      const labelKey = Object.keys(featureLabels)
        .find(feature => isfeatureEnabled && isfeatureEnabled(feature));
      if (labelKey) {
        newLabel = featureLabels[labelKey];
      }
    }
    const container = document.createElement('div');
    container.className = 'field-wrapper json-button-container';
    if (newLabel || label) {
      const labelEl = document.createElement('label');
      labelEl.textContent = newLabel || label;
      container.appendChild(labelEl);
    }
    const input = document.createElement('input');
    input.type = type || 'text';
    input.value = options[key] || '';
    input.name = key;
    input.addEventListener('change', (e) => {
      this.handleChange({ [key]: e.target.value });
    });
    container.appendChild(input);
    return container;
  }

  render() {
    const { element, fields, store } = this.props;
    const { isSuperAdmin } = store || {};
    const div = document.createElement('div');
    div.className = 'json-button-form';

    if (element && element.popcornOptions && isSuperAdmin) {
      const innerDiv = document.createElement('div');

      // DropButton placeholder
      const dropBtn = document.createElement('button');
      dropBtn.textContent = 'Drop JSON File';
      dropBtn.addEventListener('click', () => {
        // Mock upload
        const src = 'uploaded-src';
        this.props.update({ src });
      });
      innerDiv.appendChild(dropBtn);

      if (fields) {
        Object.keys(fields).forEach(key => {
          const field = this.createField(key, fields[key], element.popcornOptions);
          innerDiv.appendChild(field);
        });
      }
      div.appendChild(innerDiv);
    }

    if (element && element.popcornOptions && element.popcornOptions.src) {
      if (!isSuperAdmin) {
        const innerDiv = document.createElement('div');
        if (fields) {
          Object.keys(fields).forEach(key => {
            if (key === constant.LINK_URL) {
              const field = this.createField(key, fields[key], element.popcornOptions);
              innerDiv.appendChild(field);
            }
          });
        }
        div.appendChild(innerDiv);
      }

      // LottiePlayer placeholder
      const lottieDiv = document.createElement('div');
      lottieDiv.className = 'button-preview';
      lottieDiv.textContent = 'Lottie Player Placeholder';
      div.appendChild(lottieDiv);
    }

    return div;
  }
}

export default JsonButtonSettings;
