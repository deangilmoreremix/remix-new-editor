import { Component } from '../../base/Component.js';
import { getStore } from '../../stores/base/Store.js';
import _ from 'lodash';
import { showError } from '../../lib/services/alertService';
import { BASE_MENU } from '../../lib/constants/imageEditor/tuiEditor';

const { Pixo } = window;

const BG_COLOR = '#272735';

export class PixoImageEditor extends Component {
  constructor(props = {}) {
    super(props);
    this.mediaStore = getStore('mediaStore');

    this.state = {
      imageData: props.imageData,
      onImageEdited: props.onImageEdited,
      handleClose: props.handleClose,
      startUpload: props.startUpload,
      endUpload: props.endUpload,
      noCrop: props.noCrop || false,
      isLoading: false,
    };

    this.refEditor = null;
    this.onClose = this.onClose.bind(this);
    this.onLoadImage = this.onLoadImage.bind(this);
  }

  componentDidMount() {
    if (this.refEditor) {
      const { apiKey } = this.mediaStore.common.pixoEditor;
      const { source } = this.state.imageData;
      const { noCrop } = this.state;

      const pixoEditor = new Pixo.Bridge({
        parent: this.refEditor,
        texturesize: 1024,
        type: 'child',
        apikey: apiKey,
        sessionrestore: false,
        features: noCrop ? _.initial(BASE_MENU) : BASE_MENU,
        styles: {
          propertiespanelbgcolor: BG_COLOR,
          actionsmenubgcolor: BG_COLOR,
          editmenubgcolor: BG_COLOR,
          canvasbgcolor: BG_COLOR,
          logosrc: 'none',
          css: `
            .pixo-editmenu button {
              padding: 1vh 0;
            }
            .pixo-propertypanel-handle {
              left: -2rem !important;
            }
            .pixo-logo:before {
              padding-bottom: 0;
            }
            .pixo-mainarea {
              padding-right: 1.5rem;
              background-color: ${BG_COLOR}
            }
          `,
        },
        onSave: (img) => this.onLoadImage(img.toBlob()),
        onClose: this.onClose,
      });

      pixoEditor.edit(source);
    }
  }

  onClose() {
    if (!this.state.isLoading) {
      this.state.handleClose();
    }
  }

  async onLoadImage(image) {
    const { uploadMedia } = this.mediaStore;
    const { onImageEdited, handleClose, startUpload, endUpload } = this.state;

    let media;
    let hasError;

    try {
      this.setState({ isLoading: true });
      startUpload();
      media = await uploadMedia({ data: image, isCrop: true });
      console.log(media, 'Media section');
    } catch (e) {
      hasError = true;
      showError(e.message);
    } finally {
      this.setState({ isLoading: false });
      image = media && media.url;
      if (!hasError) {
        onImageEdited(image);
      }
      handleClose();
      endUpload();
    }
  }

  render() {
    const { isLoading } = this.state;

    const html = isLoading ? '<div class="pixo-image-loading">Uploading image... </div>' : '<div class="pixo-image-editor"></div>';

    const element = this.createElementFromHTML(html);
    if (!isLoading) {
      this.refEditor = element;
    }

    return element;
  }
}
