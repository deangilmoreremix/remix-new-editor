import { Component } from '../../vite-remix-editor/src/components/base/Component.js';

export class MediaLibrary extends Component {
  constructor(props = {}) {
    super(props);
    this.assets = props.assets || [];
    this.addMedia = props.addMedia || (() => {});
  }

  onMount() {
    const button = this.element.querySelector('.show-dropzone-btn');
    this.addEventListener(button, 'click', this.addMedia);
  }

  render() {
    const assetsHtml = this.assets.map(asset => `
      <div class="assets-list-item">
        <img class="assets-list-image" src="${asset.url}" alt="" />
      </div>
    `).join('');

    const html = `
      <div class="media-library-container">
        <div class="assets-list">
          ${assetsHtml}
        </div>
        <button class="show-dropzone-btn" type="button">Add media</button>
      </div>
    `;
    return this.createElementFromHTML(html);
  }
}

export default MediaLibrary;