import { Component } from '../../vite-remix-editor/src/components/base/Component.js';
import { getStore } from '../../vite-remix-editor/src/stores/base/Store.js';
import mediaConstants from '../../lib/constants/media.js';
import { showError } from '../../lib/services/alertService.js';
import { DropZone } from './DropZone.js';
import { DropzoneArea } from './DropzoneArea.js';

export class DropButton extends Component {
  constructor(props = {}) {
    super(props);
    this.isArea = props.isArea || false;
    this.accept = props.accept || [];
    this.onUploaded = props.onUploaded;
    this.mediaType = props.mediaType;
    this.startUpload = props.startUpload;
    this.endUpload = props.endUpload;
    this.isDisabled = props.isDisabled || false;
    this.multiple = props.multiple !== false;
    this.className = props.className || '';
    this.needSaveAsset = props.needSaveAsset !== false;

    this.mediaStore = getStore('mediaStore');
    this.acceptFormats = this.accept && this.accept.length ? this.accept : mediaConstants.ACCEPTED_MEDIA_TYPES;
  }

  onDrop = async (acceptedFiles, rejectedFiles) => {
    if (!acceptedFiles.length) {
      if (rejectedFiles.length > 0) {
        showError('Wrong Format!');
      }
      return;
    }

    if (this.startUpload) {
      this.startUpload();
    }

    try {
      const result = await this.mediaStore.saveFiles(acceptedFiles, this.needSaveAsset, this.mediaType.toUpperCase(), this.multiple);
      this.onUploaded(result);
    } catch (e) {
      showError(e.message);
    } finally {
      if (this.endUpload) {
        this.endUpload();
      }
    }
  };

  render() {
    const container = document.createElement('div');
    container.className = 'drop-area';

    const childProps = {
      onDrop: this.onDrop,
      multiple: this.multiple,
      isDisabled: this.isDisabled,
      accept: this.acceptFormats,
    };

    let child;
    if (this.isArea) {
      child = new DropzoneArea(childProps);
    } else {
      childProps.className = `button-add-file ${this.className}`;
      child = new DropZone(childProps);
    }

    child.mount(container);
    return container;
  }
}

export default DropButton;