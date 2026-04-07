import { Component } from '../../../base/Component.js';
import { getStore } from '../../../stores/base/Store.js';
import classNames from 'classnames';
import selectIcon from '../../../public/static/images/media/icon-select.svg';

export class VideoTemplate extends Component {
  constructor(props = {}) {
    super(props);
    this.templateStore = getStore('multiselectTemplateStore');

    this.state = {
      onSelect: props.onSelect,
      item: props.item,
      className: props.className,
      onPreview: props.onPreview,
      needSelect: props.needSelect,
      actions: props.actions,
    };

    this.previewContainer = null;
    this.togglePreview = this.togglePreview.bind(this);
  }

  togglePreview(state) {
    if (this.previewContainer) {
      this.previewContainer[state ? 'play' : 'pause']();
    }
  }

  render() {
    const { onSelect, item, className, onPreview, needSelect, actions } = this.state;
    const { selectedVideo } = this.templateStore;
    const { url, preview, title, poster } = item;

    const link = preview || url;
    const isWebm = link.includes('webm');

    const active = selectedVideo && selectedVideo.has(item._id);

    let innerHTML = '';

    if (active && needSelect) {
      innerHTML += `<div class="preview__select">${selectIcon}</div>`;
    }

    if (actions) {
      actions.forEach(action => {
        innerHTML += `<div class="${action.className}" onclick="${action.onClick.name}(${JSON.stringify(item)})">${action.icon}</div>`;
      });
    }

    innerHTML += `
      <video class="video" muted preload="metadata">
        <source src="${link}" type="${isWebm ? 'video/webm' : 'video/mp4'}" />
      </video>
      <div class="${classNames('overlay', { active })}" onmouseover="${this.togglePreview.name}(true)" onmouseout="${this.togglePreview.name}(false)">
        <div class="buttons-container">
          <p>${title}</p>
          ${onPreview ? `<button class="video__item__button" onclick="${onPreview.name}">Preview</button>` : ''}
        </div>
      </div>
    `;

    const html = `
      <div
        class="${classNames('video-tile', className, { active })}"
        style="background-image: url(${poster || 'https://cdn.vidcloud.io/revolution/resources/poster.png'})"
        role="button"
        tabindex="0"
        onclick="${onSelect ? onSelect.name + '(' + JSON.stringify(item) + ')' : ''}"
      >
        ${innerHTML}
      </div>
    `;

    const element = this.createElementFromHTML(html);
    this.previewContainer = element.querySelector('video');

    return element;
  }
}
