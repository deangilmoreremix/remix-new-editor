import { Component } from '../base/Component.js';
import { getStore } from '../base/Store.js';
import { showError } from '../../lib/services/alertService.js';
import { setMinMax } from '../../lib/utils/cropHelper.js';
import { DRAG_MODES } from '../../lib/constants/imageEditor/tuiEditor.js';
import { DEFAULT_RATIO } from '../../lib/constants/project.js';
import { CHECKBOX } from '../../lib/constants/forms.js';
import ImageButtons from '../imageEditor/ImageButtons.js';
import FieldBuilder from '../form/FieldBuilder.js';

export class ImageCropper extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');
    this.mediaStore = getStore('mediaStore');

    this.state = {
      isAuto: true,
    };

    this.refEditor = null;
    this.uploadFile = this.uploadFile.bind(this);
    this.handleExtraStep = this.handleExtraStep.bind(this);
    this.handleAutoToggle = this.handleAutoToggle.bind(this);
  }

  onMount() {
    this.subscribeToStore(this.projectStore, () => this.forceUpdate());
    this.subscribeToStore(this.mediaStore, () => this.forceUpdate());
  }

  async uploadFile() {
    // Simplified: assume cropping logic
    const { onImageCropped, handleClose, startUpload, endUpload, needSave, needClose, resolution } = this.props;
    const { recommendedWidth, recommendedHeight } = resolution;

    let image = 'cropped-image-url'; // Placeholder for cropped image
    let media;
    let hasError;
    if (needSave) {
      try {
        if (startUpload) startUpload();
        media = await this.mediaStore.getState().uploadMedia({ data: image, isCrop: true });
      } catch (e) {
        hasError = true;
        showError(e.message);
      } finally {
        image = media && media.url;
        if (endUpload) endUpload();
        if (!hasError) onImageCropped(image);
        if (needClose) handleClose();
      }
    } else {
      onImageCropped(image);
      if (needClose) handleClose();
    }
  }

  handleExtraStep() {
    const { openImageEditor, resolution } = this.props;
    const { recommendedWidth, recommendedHeight } = resolution;
    const image = 'cropped-image-url'; // Placeholder
    openImageEditor(image);
  }

  handleAutoToggle() {
    this.setState({ isAuto: !this.state.isAuto });
  }

  render() {
    const projectState = this.projectStore.getState();
    const { item: { ratio: { width, height } = DEFAULT_RATIO } } = projectState;
    const aspectRatio = width / height;

    const { resolution, imageData, zoomable, openImageEditor } = this.props;
    const { source } = imageData;
    const { width: recommendedWidth, height: recommendedHeight } = resolution;
    const { isAuto } = this.state;

    const editStep = openImageEditor && 'Open Image Editor';

    const html = `
      <div class="image-crop-content">
        <div class="box">
          <div class="canvas-container">
            <img src="${source}" style="height: 70vh; width: 70vw;" class="cropper-image" />
          </div>
          <div class="img-size-settings black">
            ${zoomable ? `
              <button class="zoom-icon" data-zoom="-0.1">-</button>
              <button class="zoom-icon" data-zoom="0.1">+</button>
            ` : ''}
            <div class="field-builder-placeholder"></div>
          </div>
          <div class="image-buttons-placeholder"></div>
        </div>
      </div>
    `;

    const element = this.createElementFromHTML(html);
    this.setupEventListeners(element);
    return element;
  }

  setupEventListeners(element) {
    // Simplified event listeners
    const zoomButtons = element.querySelectorAll('.zoom-icon');
    zoomButtons.forEach(btn => {
      this.addEventListener(btn, 'click', (e) => {
        const zoom = parseFloat(e.currentTarget.getAttribute('data-zoom'));
        // Implement zoom logic
      });
    });

    const fieldPlaceholder = element.querySelector('.field-builder-placeholder');
    if (fieldPlaceholder) {
      const field = new FieldBuilder({
        className: 'input-settings',
        type: CHECKBOX,
        label: 'Automatically',
        value: this.state.isAuto,
        onChange: this.handleAutoToggle
      });
      fieldPlaceholder.parentNode.replaceChild(field.render(), fieldPlaceholder);
    }

    const buttonsPlaceholder = element.querySelector('.image-buttons-placeholder');
    if (buttonsPlaceholder) {
      const buttons = new ImageButtons({
        uploadFile: this.uploadFile,
        handleClose: this.props.handleClose,
        extraStep: this.props.openImageEditor && 'Open Image Editor',
        handleExtraStep: this.handleExtraStep
      });
      buttonsPlaceholder.parentNode.replaceChild(buttons.render(), buttonsPlaceholder);
    }
  }
}

export default ImageCropper;