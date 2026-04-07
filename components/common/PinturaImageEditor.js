import { Component } from '../../base/Component.js';
import { getStore } from '../../stores/base/Store.js';
import { pintura } from '@pqina/pintura/pintura.module.css';
import '../../styles/PinturaEditor.css';
import { getEditorDefaults, createDefaultImageWriter } from '@pqina/pintura';
import { LibrarySpinnerRed } from '../media/Loader';
import { tabItems } from '../../lib/constants/library';
import { PinturaEditor } from '@pqina/react-pintura';

const editorDefaults = getEditorDefaults();

export class PinturaImageEditor extends Component {
  constructor(props = {}) {
    super(props);
    this.mediaStore = getStore('mediaStore');
    this.uiStore = getStore('uiStore');

    this.state = {
      handleClose: props.handleClose,
      options: props.options,
      onImageEdited: props.onImageEdited,
      startUpload: props.startUpload,
      endUpload: props.endUpload,
      isLoading: false,
    };

    this.handleEditorProcess = this.handleEditorProcess.bind(this);
  }

  async handleEditorProcess(imageWriterResult) {
    const { dest } = imageWriterResult;
    const reader = new FileReader();
    reader.readAsDataURL(dest);
    reader.onloadend = async () => {
      const base64data = reader.result;
      const base64Response = await fetch(`${base64data}`);
      const blob = await base64Response.blob();
      const { uploadMedia, storeAsset } = this.mediaStore;
      const { secondaryWindowType: activeTab } = this.uiStore;
      const { onImageEdited, handleClose, startUpload, endUpload } = this.state;

      let media;
      let hasError;
      try {
        this.setState({ isLoading: true });
        startUpload();
        media = await uploadMedia({ data: blob, isCrop: true });
        const fileExtension = media.url.match(/\.[0-9a-z]{1,5}$/)[0];
        let fileType = activeTab;
        Object.keys(tabItems).forEach((item) => {
          tabItems[item].formats.forEach((format) => {
            if (format === fileExtension) {
              fileType = item;
            }
          });
        });
        await storeAsset(media, fileType);
      } catch (e) {
        hasError = true;
        console.log(e.message);
      } finally {
        this.setState({ isLoading: false });
        let image = media && media.url;
        if (!hasError) {
          onImageEdited(image);
        }
        handleClose();
        endUpload();
      }
    };
  }

  render() {
    const { options, isLoading } = this.state;

    const pinturaEditor = new PinturaEditor({
      ...editorDefaults,
      className: pintura,
      src: options.src,
      onLoad: (res) => console.log('load inline image', res),
      imageWriter: createDefaultImageWriter({
        mimeType: 'image/jpeg',
        quality: 80,
        format: 'file',
      }),
      utils: [
        'crop',
        'filter',
        'finetune',
        'annotate',
        'sticker',
        'frame',
        'redact',
        'resize',
      ],
      stickers: [
        [
          'Numbers',
          ['./static/svgImages/sticker-one.svg', './static/svgImages/sticker-two.svg', './static/svgImages/sticker-three.svg'],
          {},
        ],
        [
          'Emoji',
          ['🎉', '😄', '👍', '👎', '🍕'],
          {
            icon: '<g><!-- SVG here --></g>',
            hideLabel: false,
            disabled: false,
          },
        ],
      ],
      onProcess: this.handleEditorProcess,
    });

    const html = `
      <div class="pintura">
        ${isLoading ? '<div class="pintura-loader"><div>Spinner</div></div>' : ''}
        <div style="height: 70vh">
          ${pinturaEditor.render ? pinturaEditor.render().outerHTML : '<div>Pintura Editor</div>'}
        </div>
      </div>
    `;

    return this.createElementFromHTML(html);
  }
}