import Component from '../base/Component.js';
import { createElementFromHTML } from '../../utils/jsx.js';
import VideoTile from './VideoTile.js';

export default class VideoGallery extends Component {
  constructor(options = {}) {
    super(options);
    this.items = options.items || [];
    this.loadMore = options.loadMore || (() => {});
    this.hasMore = options.hasMore || false;
    this.inWindow = options.inWindow || false;
    this.onSelect = options.onSelect || (() => {});
    this.onPreview = options.onPreview || (() => {});
  }

  handleLoadMore = () => {
    this.loadMore();
  };

  render() {
    const tilesHtml = this.items.map(item => {
      const tile = new VideoTile({
        url: item.url,
        title: item.title,
        preview: item.preview || item.url,
        poster: item.poster,
        onPreview: () => this.onPreview(item),
        onSelect: () => this.onSelect(item)
      });
      return tile.render().outerHTML;
    }).join('');

    const loadMoreButton = this.hasMore ? `
      <button class="load-more-btn" onclick="${this.handleLoadMore.name}">
        Load More Videos
      </button>
    ` : '';

    const html = `
      <div class="video-gallery generator-gallery">
        <div class="gallery-grid">
          ${tilesHtml}
        </div>
        ${loadMoreButton}
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    // Re-render if items change
    if (this.element) {
      // This would trigger a re-render in a real implementation
    }
  }

  setItems(items) {
    this.items = items;
    this.update();
  }

  mount(element) {
    super.mount(element);
    this.element.handleLoadMore = this.handleLoadMore.bind(this);
  }
}