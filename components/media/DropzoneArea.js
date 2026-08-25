import { Component } from '../../vite-remix-editor/src/components/base/Component.js';

export class DropzoneArea extends Component {
  constructor(props = {}) {
    super(props);
    this.accept = props.accept || [];
    this.onDrop = props.onDrop;
    this.isDisabled = props.isDisabled || false;
    this.inline = props.inline !== false;
    this.multiple = props.multiple !== false;
    this.value = props.value || '';
    this.className = props.className || '';
    this.isArrows = props.isArrows !== false;
    this.state = { isDragActive: false };
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
    this.setState({ isDragActive: true });
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ isDragActive: false });
  }

  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ isDragActive: false });

    const files = Array.from(e.dataTransfer.files);
    if (this.onDrop) {
      this.onDrop(files, []);
    }
  }

  handleFileChange(e) {
    const files = Array.from(e.target.files);
    if (this.onDrop) {
      this.onDrop(files, []);
    }
  }

  render() {
    const { isDragActive } = this.state;
    const baseClass = this.inline ? 'drag-drop' : 'dropzone-container';
    const classes = [
      baseClass,
      this.className,
      isDragActive && (this.inline ? 'drag-drop-active' : 'drag'),
      this.isDisabled && (this.inline ? 'drag-drop-disabled' : ''),
    ].filter(Boolean).join(' ');

    if (this.inline) {
      const content = this.value
        ? `<img src="${this.value}" alt="" />`
        : '<p class="drag-drop__text">Drag and drop an image here, or click to upload</p>';
      const arrows = !this.value && this.isArrows
        ? `
          <img class="drag-arrow drag-arrow-upper-left" src="../../public/static/svgImages/arrow-upper-left.svg" alt="arrow" />
          <img class="drag-arrow drag-arrow-upper-right" src="../../public/static/svgImages/arrow-upper-left.svg" alt="arrow" />
          <img class="drag-arrow drag-arrow-bottom-left" src="../../public/static/svgImages/arrow-upper-left.svg" alt="arrow" />
          <img class="drag-arrow drag-arrow-bottom-right" src="../../public/static/svgImages/arrow-upper-left.svg" alt="arrow" />
        `
        : '';
      const html = `
        <div class="${classes}">
          <input type="file" accept="${this.accept.join(',')}" ${this.isDisabled ? 'disabled' : ''} ${this.multiple ? 'multiple' : ''} />
          ${content}
          ${arrows}
        </div>
      `;
      return this.createElementFromHTML(html);
    } else {
      const overlay = isDragActive ? '<div class="overlay" />' : '';
      const html = `
        <div class="${classes}">
          <input type="file" accept="${this.accept.join(',')}" ${this.isDisabled ? 'disabled' : ''} ${this.multiple ? 'multiple' : ''} />
          <div class="dropzone-placeholder ${isDragActive ? 'drag' : ''}">
            <img class="dropzone-placeholder-item dropzone-placeholder-item-inline" src="../../public/static/images/media/icon-audio.svg" alt="audio" />
            <img class="dropzone-placeholder-item dropzone-placeholder-item-inline" src="../../public/static/images/media/icon-video.svg" alt="video" />
            <img class="dropzone-placeholder-item dropzone-placeholder-item-inline" src="../../public/static/images/media/icon-image.svg" alt="image" />
            ${overlay}
          </div>
        </div>
      `;
      return this.createElementFromHTML(html);
    }
  }
}

export default DropzoneArea;