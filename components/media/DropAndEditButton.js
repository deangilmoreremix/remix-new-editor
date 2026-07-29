import { Component } from '../../vite-remix-editor/src/components/base/Component.js';
import { getStore } from '../../vite-remix-editor/src/stores/base/Store.js';
import classnames from 'classnames';
import { showConfirmation, showError, showSuccess } from '../../lib/services/alertService.js';
import { CROP_RECOMMENDED_RESOLUTION } from '../../lib/constants/settings/image.js';
import { ASSET_TYPES, GIF_FORMAT, GIF_WARNING, IMAGE_FORMATS } from '../../lib/constants/media.js';
import { DropZone } from './DropZone.js';
import { DropzoneArea } from './DropzoneArea.js';
import { HelpIconComponent } from '../common/HelpIcon.js';

const IMAGE_FORMATS_WITH_GIF = [...IMAGE_FORMATS, GIF_FORMAT];

export class DropAndEditButton extends Component {
  constructor(props = {}) {
    super(props);
    this.isArea = props.isArea || false;
    this.isRemovable = props.isRemovable || false;
    this.onUploaded = props.onUploaded;
    this.startUpload = props.startUpload;
    this.endUpload = props.endUpload;
    this.className = props.className || '';
    this.needSaveAsset = props.needSaveAsset !== false;
    this.recommendedResolution = props.recommendedResolution || CROP_RECOMMENDED_RESOLUTION;
    this.tooltipMessage = props.tooltipMessage || '';
    this.zoomable = props.zoomable || false;
    this.openImageEditor = props.openImageEditor;
    this.allowedGif = props.allowedGif || false;
    this.fallbackValue = props.fallbackValue;

    this.mediaStore = getStore('mediaStore');
    this.modalStore = getStore('modalStore');
    this.projectStore = getStore('projectStore');

    this.uploadButtonRef = null;

    this.propsMemo = {
      multiple: false,
      accept: this.allowedGif ? IMAGE_FORMATS_WITH_GIF : IMAGE_FORMATS,
    };
  }

  onDrop = async (acceptedFiles, rejectedFiles) => {
    if (!acceptedFiles.length) {
      if (rejectedFiles.length > 0) {
        showError('Wrong Format!');
      }
      return;
    }

    if (this.uploadButtonRef) {
      this.uploadButtonRef.value = '';
    }

    const image = acceptedFiles[0];
    image.src = URL.createObjectURL(image);

    if (image.type === GIF_FORMAT) {
      try {
        if (this.startUpload) this.startUpload();
        const media = await this.mediaStore.uploadMedia({ data: image });
        await this.save(media && media.url, image.type);
        if (this.endUpload) this.endUpload();
        this.projectStore.showWarning(GIF_WARNING);
      } catch (e) {
        showError(e.message);
      }
    } else {
      this.modalStore.openCropper({
        image,
        onImageCropped: this.save.bind(this),
        openImageEditor: this.openImageEditor,
        recommendedResolution: this.recommendedResolution,
        cancelCropper: () => this.save(image),
        startUpload: this.startUpload,
        endUpload: this.endUpload,
        zoomable: this.zoomable,
      });
    }
  };

  save = async (src, type) => {
    if (this.startUpload) {
      this.startUpload();
    }
    const result = await this.mediaStore.saveFile(src, this.needSaveAsset, ASSET_TYPES.IMAGE);
    this.onUploaded(result, type);
    if (this.endUpload) {
      this.endUpload();
    }
  };

  onRemoveImage = async () => {
    const response = await showConfirmation('Are you sure you want to remove the image?', 'Remove image');
    if (response) {
      this.onUploaded(!!this.fallbackValue && { url: this.fallbackValue });
      showSuccess('Image is successfully removed');
    }
  };

  render() {
    const container = document.createElement('div');
    container.className = 'drop-area';

    const childProps = {
      onDrop: this.onDrop,
      ...this.propsMemo,
      ...this.props,
    };

    if (this.isArea) {
      const area = new DropzoneArea(childProps);
      area.mount(container);

      if (this.isRemovable) {
        const icon = document.createElement('img');
        icon.src = '../../public/static/svgImages/common/remove-image-icon.svg';
        icon.className = 'drop-area__icon';
        icon.addEventListener('click', this.onRemoveImage.bind(this));
        container.appendChild(icon);
      }
    } else {
      childProps.className = classnames('button-add-file', this.className);
      const zone = new DropZone(childProps);
      zone.mount(container);
      this.uploadButtonRef = zone.querySelector('input');

      if (this.tooltipMessage) {
        const helpIcon = new HelpIconComponent({ isText: true, message: this.tooltipMessage });
        helpIcon.mount(container);
      }
    }

    return container;
  }
}

export default DropAndEditButton;