import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';

export default class MediaLibrary extends Component {
  constructor(options = {}) {
    super(options);
    this.assets = options.assets || [];
    this.addMedia = options.addMedia || (() => {});
  }

  handleAddMedia = () => {
    this.addMedia();
  };

  render() {
    const assetsHtml = this.assets.map(asset => `
      <div class="assets-list-item" key="${asset.url}">
        <img class="assets-list-image" src="${asset.url}" alt="" />
      </div>
    `).join('');

    const html = `
      <div class="media-library-container">
        <div class="assets-list">
          ${assetsHtml}
        </div>
        <button class="show-dropzone-btn" type="button" onclick="${this.handleAddMedia.name}">Add media</button>
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    // Re-render if assets change
    if (this.element) {
      // This would trigger a re-render in a real implementation
    }
  }

  setAssets(assets) {
    this.assets = assets;
    this.update();
  }

  mount(element) {
    super.mount(element);
    this.element.handleAddMedia = this.handleAddMedia.bind(this);
  }
}