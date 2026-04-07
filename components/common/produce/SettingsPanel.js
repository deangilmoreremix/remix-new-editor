import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import { rgba2hex } from '../../../lib/lottie/utils.js';
import { CROP_RECOMMENDED_RESOLUTION } from '../../../lib/constants/settings/image.js';
import { IMAGE_CROPPER_MODAL } from '../../../lib/constants/modals.js';
import { GIF_FORMAT, GIF_WARNING } from '../../../lib/constants/media.js';
import { produceTooltips } from '../../../lib/constants/tooltips.js';
import { DEFAULT_THUMBNAIL } from '../../../lib/constants/project.js';
import FieldBuilder from '../../form/FieldBuilder.js';
import DropAndEditButton from '../../media/DropAndEditButton.js';
import HelpIconComponent from '../HelpIcon.js';

export class SettingsPanel extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');
    this.userStore = getStore('userStore');
    this.modalStore = getStore('modalStore');

    this.state = {
      isDisabledUpload: false,
    };

    this.handleTitleChange = this.handleTitleChange.bind(this);
    this.handleDescriptionChange = this.handleDescriptionChange.bind(this);
    this.handlePreviewChange = this.handlePreviewChange.bind(this);
    this.handleColorChange = this.handleColorChange.bind(this);
    this.handlePlaybarChange = this.handlePlaybarChange.bind(this);
    this.handleTagsChange = this.handleTagsChange.bind(this);
    this.handleCategoriesChange = this.handleCategoriesChange.bind(this);
    this.handleSocialChange = this.handleSocialChange.bind(this);
    this.handleOpenEditor = this.handleOpenEditor.bind(this);
    this.handleUploadedImage = this.handleUploadedImage.bind(this);
    this.handleImageEdited = this.handleImageEdited.bind(this);
  }

  onMount() {
    this.subscribeToStore(this.projectStore, () => this.forceUpdate());
    this.subscribeToStore(this.userStore, () => this.forceUpdate());
    this.subscribeToStore(this.modalStore, () => this.forceUpdate());
  }

  handleTitleChange(e) {
    this.projectStore.getState().updateItem({ title: e.target.value });
  }

  handleDescriptionChange(e) {
    this.projectStore.getState().updateItem({ description: e.target.value });
  }

  handlePreviewChange(e) {
    this.projectStore.getState().updateItem({ preview: e.target.value });
  }

  handleColorChange(e) {
    const rgbColor = { background: e.target.value }; // Assuming color picker gives hex
    const hexColor = rgba2hex(e.target.value);
    this.projectStore.getState().updateItem({ background: hexColor });
  }

  handlePlaybarChange(e) {
    const item = this.projectStore.getState().item;
    this.projectStore.getState().updateItem({ disabledPlaybar: !item.disabledPlaybar });
  }

  handleTagsChange(tags) {
    this.projectStore.getState().updateItem({ tags });
  }

  handleCategoriesChange(categories) {
    // Handle categories
  }

  handleSocialChange(e) {
    const socialKey = e.target.name;
    const socialValue = e.target.checked;
    const item = this.projectStore.getState().item;
    let allowedSocials = item.allowedSocials || [];

    if (socialValue && !allowedSocials.includes(socialKey)) {
      allowedSocials.push(socialKey);
    } else if (!socialValue && allowedSocials.includes(socialKey)) {
      allowedSocials = allowedSocials.filter(s => s !== socialKey);
    }
    this.projectStore.getState().updateItem({ allowedSocials });
  }

  handleOpenEditor(image) {
    this.modalStore.getState().closeModal(IMAGE_CROPPER_MODAL);
    this.modalStore.getState().openImglyEditorCropper({
      src: image || this.projectStore.getState().item.thumbnail,
      onImageEdited: this.handleImageEdited,
      startUpload: () => this.setState({ isDisabledUpload: true }),
      endUpload: () => this.setState({ isDisabledUpload: false }),
      noCrop: true,
    });
  }

  handleUploadedImage(image, type) {
    this.projectStore.getState().updateItem({ thumbnail: image.url, type });
  }

  handleImageEdited(thumbnail) {
    this.projectStore.getState().updateItem({ thumbnail });
  }

  render() {
    const { linkedinEnabled, isSuperAdmin } = this.userStore.getState();
    const item = this.projectStore.getState().item;
    const { isDisabledUpload } = this.state;
    const categories = item.categories || [];

    const html = `
      <div class="produce-block settings-panel">
        <div class="settings__inputs">
          <div class="field-builder">
            <label class="settings-panel-text">Title</label>
            <input type="text" name="title" value="${item.title || ''}" class="settings-input" placeholder="My Perfect Videos" />
          </div>
          <div class="field-builder">
            <label class="settings-panel-text">Description</label>
            <textarea name="description" class="settings-input" rows="5" placeholder="A project about">${item.description || ''}</textarea>
          </div>
          ${isSuperAdmin ? `
            <div class="field-builder">
              <label class="settings-panel-text">Preview</label>
              <input type="text" name="preview" value="${item.preview || ''}" class="settings-input" placeholder="Preview link" />
            </div>
          ` : ''}
          <div class="field-builder">
            <label>Background Color</label>
            <input type="color" name="background" value="${item.background || '#ffffff'}" class="settings-formcolor" />
          </div>
          <div class="field-builder">
            <label class="settings-checkbox settings-checkbox-playbar">
              <input type="checkbox" name="disabledPlaybar" ${!item.disabledPlaybar ? 'checked' : ''} />
              Show playbar
            </label>
          </div>
        </div>
        <div class="settings__inputs">
          <div class="field-builder">
            <label class="settings-panel-text">Tags</label>
            <input type="text" class="settings-input" placeholder="Tags" />
          </div>
          ${isSuperAdmin ? `
            <div class="field-builder">
              <label>Categories</label>
              <select multiple class="settings-input">
                ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
              </select>
            </div>
          ` : ''}
          <div class="settings-allow">
            <div class="settings-allow__label-box">
              <p class="settings-panel-text">Allow</p>
              <div class="help-icon-placeholder"></div>
            </div>
            <div class="field-builder">
              <label class="settings-checkbox">
                <input type="checkbox" name="facebook" ${item.allowedSocials && item.allowedSocials.includes('facebook') ? 'checked' : ''} />
                Facebook
              </label>
            </div>
            ${linkedinEnabled ? `
              <div class="field-builder">
                <label class="settings-checkbox">
                  <input type="checkbox" name="linkedin" ${item.allowedSocials && item.allowedSocials.includes('linkedin') ? 'checked' : ''} />
                  LinkedIn
                </label>
              </div>
            ` : ''}
          </div>
          <div class="settings__row">
            <div class="settings__row-block">
              <div class="settings__row-img">
                <p class="settings__row-text">Thumbnail</p>
                <div class="settings-img-preview"><img src="${item.thumbnail}" alt="" /></div>
              </div>
            </div>
            <div class="settings__row-block">
              ${item.thumbnail && item.type !== GIF_FORMAT ? `
                <button class="settings__edit-file">Image Editor</button>
              ` : `
                <span class="settings__gif-message">${GIF_WARNING}</span>
              `}
            </div>
          </div>
          <div class="settings__row">
            <div class="settings__row-block">
              <div class="settings__first-row-block">
                <div class="drop-and-edit-placeholder"></div>
              </div>
              <p class="settings__row-text-2">
                recommended image resolution ${CROP_RECOMMENDED_RESOLUTION.width} x ${CROP_RECOMMENDED_RESOLUTION.height}
              </p>
            </div>
            <div class="settings__row-block">
              <div class="drop-and-edit-area-placeholder"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const element = this.createElementFromHTML(html);
    this.setupEventListeners(element);
    return element;
  }

  setupEventListeners(element) {
    const titleInput = element.querySelector('input[name="title"]');
    if (titleInput) this.addEventListener(titleInput, 'input', this.handleTitleChange);

    const descTextarea = element.querySelector('textarea[name="description"]');
    if (descTextarea) this.addEventListener(descTextarea, 'input', this.handleDescriptionChange);

    const previewInput = element.querySelector('input[name="preview"]');
    if (previewInput) this.addEventListener(previewInput, 'input', this.handlePreviewChange);

    const colorInput = element.querySelector('input[name="background"]');
    if (colorInput) this.addEventListener(colorInput, 'input', this.handleColorChange);

    const playbarCheckbox = element.querySelector('input[name="disabledPlaybar"]');
    if (playbarCheckbox) this.addEventListener(playbarCheckbox, 'change', this.handlePlaybarChange);

    const facebookCheckbox = element.querySelector('input[name="facebook"]');
    if (facebookCheckbox) this.addEventListener(facebookCheckbox, 'change', this.handleSocialChange);

    const linkedinCheckbox = element.querySelector('input[name="linkedin"]');
    if (linkedinCheckbox) this.addEventListener(linkedinCheckbox, 'change', this.handleSocialChange);

    const editButton = element.querySelector('.settings__edit-file');
    if (editButton) this.addEventListener(editButton, 'click', () => this.handleOpenEditor());

    // For DropAndEditButton, instantiate components
    const dropPlaceholder = element.querySelector('.drop-and-edit-placeholder');
    if (dropPlaceholder) {
      const dropBtn = new DropAndEditButton({
        allowedGif: true,
        onUploaded: this.handleUploadedImage,
        isDisabled: this.state.isDisabledUpload,
        startUpload: () => this.setState({ isDisabledUpload: true }),
        endUpload: () => this.setState({ isDisabledUpload: false }),
        needSaveAsset: false,
        tooltipMessage: produceTooltips.thumbnailUpload,
        openImageEditor: (image) => this.handleOpenEditor(image)
      });
      dropPlaceholder.parentNode.replaceChild(dropBtn.render(), dropPlaceholder);
    }

    const dropAreaPlaceholder = element.querySelector('.drop-and-edit-area-placeholder');
    if (dropAreaPlaceholder) {
      const dropAreaBtn = new DropAndEditButton({
        isArea: true,
        allowedGif: true,
        isRemovable: this.projectStore.getState().item.thumbnail !== DEFAULT_THUMBNAIL,
        fallbackValue: DEFAULT_THUMBNAIL,
        onUploaded: this.handleUploadedImage,
        isDisabled: this.state.isDisabledUpload,
        value: this.projectStore.getState().item.thumbnail,
        startUpload: () => this.setState({ isDisabledUpload: true }),
        endUpload: () => this.setState({ isDisabledUpload: false }),
        needSaveAsset: false,
        openImageEditor: (image) => this.handleOpenEditor(image)
      });
      dropAreaPlaceholder.parentNode.replaceChild(dropAreaBtn.render(), dropAreaPlaceholder);
    }

    const helpIconPlaceholder = element.querySelector('.help-icon-placeholder');
    if (helpIconPlaceholder) {
      const helpIcon = new HelpIconComponent({
        isText: true,
        padding: '0 1.56rem 0 0',
        height: 25,
        message: produceTooltips.allow
      });
      helpIconPlaceholder.parentNode.replaceChild(helpIcon.render(), helpIconPlaceholder);
    }
  }
}

export default SettingsPanel;