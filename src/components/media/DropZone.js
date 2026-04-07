import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';
import LibrarySpinner from '../common/LibrarySpinner.js';

export default class DropZone extends Component {
  constructor(options = {}) {
    super(options);
    this.accept = options.accept || [];
    this.onDrop = options.onDrop || (() => {});
    this.isDisabled = options.isDisabled || false;
    this.multiple = options.multiple !== false;
    this.className = options.className || 'drop-zone';
    this.isDragging = false;
  }

  handleDragOver = (event) => {
    event.preventDefault();
    if (!this.isDisabled) {
      this.isDragging = true;
      this.update();
    }
  };

  handleDragLeave = (event) => {
    event.preventDefault();
    this.isDragging = false;
    this.update();
  };

  handleDrop = (event) => {
    event.preventDefault();
    this.isDragging = false;

    if (this.isDisabled) return;

    const files = Array.from(event.dataTransfer.files);
    const acceptedFiles = this.filterAcceptedFiles(files);

    if (acceptedFiles.length > 0) {
      this.onDrop(acceptedFiles);
    }

    this.update();
  };

  handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const acceptedFiles = this.filterAcceptedFiles(files);

    if (acceptedFiles.length > 0) {
      this.onDrop(acceptedFiles);
    }
  };

  filterAcceptedFiles(files) {
    if (this.accept.length === 0) return files;

    return files.filter(file => {
      const fileType = file.type.toLowerCase();
      const fileName = file.name.toLowerCase();

      return this.accept.some(acceptedType => {
        const type = acceptedType.toLowerCase();
        return fileType.includes(type) || fileName.endsWith(type);
      });
    });
  }

  render() {
    const acceptString = this.accept.join(',');

    const html = `
      <div class="${this.className} ${this.isDragging ? 'dragging' : ''} ${this.isDisabled ? 'disabled' : ''}"
           ondragover="this.handleDragOver(event)"
           ondragleave="this.handleDragLeave(event)"
           ondrop="this.handleDrop(event)">
        <label class="button-add-file__label">
          <input
            type="file"
            accept="${acceptString}"
            ${this.multiple ? 'multiple' : ''}
            ${this.isDisabled ? 'disabled' : ''}
            onchange="this.handleFileSelect(event)"
          />
          ${this.isDisabled ?
            new LibrarySpinner({ isLoading: true }).render().outerHTML :
            '<span>Upload</span>'
          }
        </label>
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    if (this.element) {
      this.element.classList.toggle('dragging', this.isDragging);
      this.element.classList.toggle('disabled', this.isDisabled);
    }
  }

  mount(element) {
    super.mount(element);
    this.element.handleDragOver = this.handleDragOver.bind(this);
    this.element.handleDragLeave = this.handleDragLeave.bind(this);
    this.element.handleDrop = this.handleDrop.bind(this);
    this.element.handleFileSelect = this.handleFileSelect.bind(this);
  }
}