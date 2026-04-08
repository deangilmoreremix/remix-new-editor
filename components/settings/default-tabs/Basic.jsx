import lottie from 'lottie-web';
import classnames from 'classnames';

import { POPCORN_ELEMENT_TYPES } from '../../../lib/constants/popcorn';
import { loadUrl } from '../../../lib/requestCreator';

import Component from '../../base/Component';

export class Basic extends Component {
  constructor(props = {}) {
    super(props);
    this.state = {
      isDisabled: false,
    };
    this.onUploaded = this.onUploaded.bind(this);
    this.processUpload = this.processUpload.bind(this);
    this.createField = this.createField.bind(this);
  }

  async onUploaded({ url }) {
    if (this.props.options.type === POPCORN_ELEMENT_TYPES.JSON_TRANSITION) {
      const animationData = await loadUrl(url);
      const animation = await lottie.loadAnimation({ animationData });
      const duration = animation.totalFrames / animation.animationData.fr;
      return this.props.update({ url, end: this.props.options.start + duration });
    }
    this.props.update({ url });
  }

  processUpload(processFileUpload) {
    this.setState({ isDisabled: processFileUpload });
  }

  createField(key, field) {
    const { label, type, ...fieldProps } = field;
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
      input.disabled = this.state.isDisabled;
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          this.processUpload(true);
          // Assume upload logic here, for now mock
          const url = 'uploaded-url'; // Replace with actual upload
          await this.onUploaded({ url });
          this.processUpload(false);
        }
      });
    } else {
      input = document.createElement('input');
      input.type = type || 'text';
      input.value = this.props.options[key] || field.default || '';
      input.name = key;
      input.id = key;
      input.disabled = this.state.isDisabled;
      input.addEventListener('change', (e) => {
        this.props.update({ [key]: e.target.value });
      });
    }
    container.appendChild(input);
    return container;
  }

  render() {
    const { fields, element, containerClass } = this.props;
    const div = document.createElement('div');
    div.className = classnames(element && element.type && `inputs-${element.type}-wrapper`, containerClass);
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
