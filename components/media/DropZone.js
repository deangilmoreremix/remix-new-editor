import { Component } from '../../vite-remix-editor/src/components/base/Component.js';
import { LibrarySpinner } from './Loader.js';

export class DropZone extends Component {
  constructor(props = {}) {
    super(props);
    this.accept = props.accept;
    this.onDrop = props.onDrop;
    this.isDisabled = props.isDisabled || false;
    this.multiple = props.multiple !== false;
    this.className = props.className || '';
  }

  onMount() {
    this.setupDropZone();
  }

  setupDropZone() {
    const container = this.element;
    const input = container.querySelector('input');

    if (!this.isDisabled) {
      this.addEventListener(container, 'dragover', this.handleDragOver.bind(this));
      this.addEventListener(container, 'dragleave', this.handleDragLeave.bind(this));
      this.addEventListener(container, 'drop', this.handleDrop.bind(this));
      this.addEventListener(input, 'change', this.handleFileChange.bind(this));
    }
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.element.classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.element.classList.remove('drag-over');
  }

  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.element.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    if (this.onDrop) {
      this.onDrop(files, []); // Assuming no rejected
    }
  }

  handleFileChange(e) {
    const files = Array.from(e.target.files);
    if (this.onDrop) {
      this.onDrop(files, []);
    }
  }

  render() {
    const spinnerHtml = this.isDisabled ? new LibrarySpinner().render().outerHTML : '<span>Upload</span>';
    const html = `
      <div class="${this.className}">
        <label class="button-add-file__label">
          <input type="file" accept="${this.accept.join(',')}" ${this.isDisabled ? 'disabled' : ''} ${this.multiple ? 'multiple' : ''} />
          ${spinnerHtml}
        </label>
      </div>
    `;
    return this.createElementFromHTML(html);
  }
}

export default DropZone;