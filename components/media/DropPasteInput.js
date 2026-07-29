import { Component } from '../../vite-remix-editor/src/components/base/Component.js';
import mediaConstants from '../../lib/constants/media.js';
import { ENTER_KEY } from '../../lib/constants/keyCodes.js';

export class DropPasteInput extends Component {
  constructor(props = {}) {
    super(props);
    this.accept = props.accept || [];
    this.onDrop = props.onDrop;
    this.isDisabled = props.isDisabled || false;
    this.onEnter = props.onEnter;
    this.placeholder = props.placeholder || 'Drop your file here to start uploading it. Paste the URL/Link to external video hosting (Youtube, Vimeo, etc) and click Enter.';
    this.state = { currentValue: '' };
  }

  onMount() {
    this.setupDropZone();
  }

  setupDropZone() {
    const textarea = this.element.querySelector('textarea');
    const input = this.element.querySelector('input');

    if (!this.isDisabled) {
      this.addEventListener(textarea, 'dragover', this.handleDragOver.bind(this));
      this.addEventListener(textarea, 'drop', this.handleDrop.bind(this));
      this.addEventListener(textarea, 'paste', this.handlePaste.bind(this));
      this.addEventListener(textarea, 'change', this.onChange.bind(this));
      this.addEventListener(textarea, 'keypress', this.onKeyPress.bind(this));
      this.addEventListener(input, 'change', this.handleFileChange.bind(this));
    }
  }

  handleDragOver(e) {
    e.preventDefault();
  }

  handleDrop(e) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (this.onDrop) {
      this.onDrop(files, []);
    }
  }

  handlePaste(e) {
    // Handle paste if needed
  }

  handleFileChange(e) {
    const files = Array.from(e.target.files);
    if (this.onDrop) {
      this.onDrop(files, []);
    }
  }

  onChange(e) {
    this.setState({ currentValue: e.target.value });
  }

  onKeyPress(e) {
    if (e.which === ENTER_KEY) {
      e.preventDefault();
      this.onEnter(this.state.currentValue);
    }
  }

  render() {
    const acceptFormats = this.accept && this.accept.length ? this.accept : mediaConstants.ACCEPTED_MEDIA_TYPES;
    const html = `
      <div class="container-textarea">
        <textarea class="text-input" placeholder="${this.placeholder}" value="${this.state.currentValue}"></textarea>
        <input type="file" accept="${acceptFormats.join(',')}" ${this.isDisabled ? 'disabled' : ''} multiple="false" />
        <p class="label">Paste or drop media to upload</p>
      </div>
    `;
    const element = this.createElementFromHTML(html);
    const textarea = element.querySelector('textarea');
    textarea.value = this.state.currentValue;
    return element;
  }
}

export default DropPasteInput;