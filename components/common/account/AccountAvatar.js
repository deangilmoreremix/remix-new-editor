import { Component } from '../../../base/Component.js';
import classnames from 'classnames';
import DropAndEditButton from '../../media/DropAndEditButton.js';
import uploadAvatarIcon from '../../../public/static/svgImages/common/upload-avatar-icon.svg';

export class AccountAvatar extends Component {
  constructor(props = {}) {
    super(props);

    this.state = {
      photo: props.photo,
      hasPermissions: props.hasPermissions,
      onUploadImage: props.onUploadImage,
      isDisabledUpload: false,
    };

    this.startUpload = this.startUpload.bind(this);
    this.endUpload = this.endUpload.bind(this);
  }

  startUpload() {
    this.setState({ isDisabledUpload: true });
  }

  endUpload() {
    this.setState({ isDisabledUpload: false });
  }

  render() {
    const { photo, hasPermissions, onUploadImage, isDisabledUpload } = this.state;

    const dropAndEditButton = new DropAndEditButton({
      needSaveAsset: false,
      className: 'user-panel__avatar-upload',
      recommendedResolution: { width: 300, height: 300 },
      onUploaded: onUploadImage,
      isDisabled: isDisabledUpload,
      startUpload: this.startUpload,
      endUpload: this.endUpload,
    });

    const html = `
      <div class="user-panel__avatar">
        ${photo ? `<img src="${photo}" class="user-panel__avatar-custom" alt="user-avatar" />` : `
          <label for="upload-file" class="${classnames('user-panel__avatar-custom', { 'avatar-dark-theme': hasPermissions })}">
            <div class="user-panel__avatar-icon">${uploadAvatarIcon}</div>
          </label>
        `}
        <div class="text-center user-panel__avatar-hint">
          <span class="user-panel__avatar-span-hint">The recommended image is 300 by 300 pixels</span>
          ${dropAndEditButton.render().outerHTML}
        </div>
      </div>
    `;

    return this.createElementFromHTML(html);
  }
}
