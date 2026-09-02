import { Component } from '../base/Component.js';
import { DEFAULT_IFRAME_SIZE } from '../../lib/constants/campaigns/constants.js';
import { styledIframeWithScript } from '../../lib/generators/iframe.js';

export class EmbedDataContainer extends Component {
  constructor(props = {}) {
    super(props);
    this.state = {
      size: { ...DEFAULT_IFRAME_SIZE },
      needPlayButton: props.playCheckbox || false,
    };
  }

  setupEventListeners() {
    const widthInput = this.querySelector('input[name="width"]');
    const heightInput = this.querySelector('input[name="height"]');
    const checkbox = this.querySelector('#preload-check');
    const textarea = this.querySelector('textarea');

    if (widthInput) {
      this.addEventListener(widthInput, 'change', this.handleInputChange.bind(this));
    }
    if (heightInput) {
      this.addEventListener(heightInput, 'change', this.handleInputChange.bind(this));
    }
    if (checkbox) {
      this.addEventListener(checkbox, 'change', () => {
        this.setState({ needPlayButton: !this.state.needPlayButton });
      });
    }
    if (textarea) {
      this.addEventListener(textarea, 'click', this.handleTextAreaClick.bind(this));
    }
  }

  handleInputChange(event) {
    const { name, value } = event.target;
    this.setState({
      size: { ...this.state.size, [name]: parseInt(value, 10) || 0 },
    });
  }

  handleTextAreaClick(event) {
    event.target.select();
  }

  render() {
    const fragment = document.createDocumentFragment();

    const container = document.createElement('div');
    container.className = this.props.className || '';
    fragment.appendChild(container);

    if (this.props.resizable) {
      const resizer = document.createElement('div');
      resizer.className = 'resizer row mb-2';
      container.appendChild(resizer);

      const sizeLabel = document.createElement('div');
      sizeLabel.className = 'col-md-4';
      sizeLabel.textContent = 'Size';
      resizer.appendChild(sizeLabel);

      const inputsDiv = document.createElement('div');
      inputsDiv.className = 'col-md-8 d-flex justify-content-between';
      resizer.appendChild(inputsDiv);

      const widthInput = document.createElement('input');
      widthInput.className = 'dimension-input';
      widthInput.type = 'text';
      widthInput.name = 'width';
      widthInput.value = this.state.size.width;
      inputsDiv.appendChild(widthInput);

      const xSpan = document.createElement('span');
      xSpan.className = 'mx-1';
      xSpan.textContent = 'X';
      inputsDiv.appendChild(xSpan);

      const heightInput = document.createElement('input');
      heightInput.className = 'dimension-input';
      heightInput.type = 'text';
      heightInput.name = 'height';
      heightInput.value = this.state.size.height;
      inputsDiv.appendChild(heightInput);
    }

    if (this.props.playCheckbox) {
      const embedGroup = document.createElement('div');
      embedGroup.className = 'embed-group mb-3';
      container.appendChild(embedGroup);

      const label = document.createElement('label');
      label.className = 'cell row mb-2';
      label.htmlFor = 'preload-check';
      embedGroup.appendChild(label);

      const labelDiv1 = document.createElement('div');
      labelDiv1.className = 'col-md-4';
      labelDiv1.textContent = 'Show Play Button';
      label.appendChild(labelDiv1);

      const labelDiv2 = document.createElement('div');
      labelDiv2.className = 'col-md-8';
      label.appendChild(labelDiv2);

      const customCheckbox = document.createElement('div');
      customCheckbox.className = 'custom-checkbox';
      labelDiv2.appendChild(customCheckbox);

      const checkbox = document.createElement('input');
      checkbox.className = 'cell';
      checkbox.type = 'checkbox';
      checkbox.id = 'preload-check';
      checkbox.checked = this.state.needPlayButton;
      customCheckbox.appendChild(checkbox);

      const span = document.createElement('span');
      span.className = 'label';
      customCheckbox.appendChild(span);
    }

    const textarea = document.createElement('textarea');
    textarea.readOnly = true;
    textarea.rows = 4;
    textarea.value = this.props.stringGenerator(
      this.props.url,
      this.state.size.width,
      this.state.size.height,
      this.props.thumbnail,
      this.state.needPlayButton
    );
    container.appendChild(textarea);

    return container;
  }
}

EmbedDataContainer.propTypes = {
  className: PropTypes.string,
  thumbnail: PropTypes.string,
  url: PropTypes.string.isRequired,
  resizable: PropTypes.bool,
  stringGenerator: PropTypes.func,
  playCheckbox: PropTypes.bool,
};

export default EmbedDataContainer;