import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import { LibrarySpinner } from '../Loader.js';
import { VideoTile } from './VideoTile.js';
import { PREVIEW_MEDIA_MODAL } from '../../../lib/constants/modals.js';

export class VideoGallery extends Component {
  constructor(props = {}) {
    super(props);
    this.items = props.items || [];
    this.loadMore = props.loadMore;
    this.hasMore = props.hasMore || false;
    this.inWindow = props.inWindow || false;
    this.onSelect = props.onSelect;

    this.modalStore = getStore('modalStore');
    this.sizes = this.inWindow
      ? [{ columns: 2, gutter: 5 }]
      : [
          { mq: '512px', columns: 2, gutter: 5 },
          { mq: '780px', columns: 3, gutter: 5 },
          { mq: '1300px', columns: 4, gutter: 10 },
          { mq: '1650px', columns: 5, gutter: 15 },
        ];
  }

  onMount() {
    this.setupInfiniteScroll();
  }

  setupInfiniteScroll() {
    // Simple implementation, in real would use IntersectionObserver
    const container = this.element;
    this.addEventListener(window, 'scroll', () => {
      if (this.hasMore && window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        this.loadMore();
      }
    });
  }

  render() {
    const container = document.createElement('div');
    container.className = 'generator-gallery';

    this.items.forEach(item => {
      const tile = new VideoTile({
        url: item.url,
        title: item.title,
        preview: item.preview || item.url,
        poster: item.poster,
        onPreview: () => this.modalStore.openModal(PREVIEW_MEDIA_MODAL, {
          item, activeTab: 'VIDEO', volume: 100, mute: false, hasUse: false,
        }),
        onSelect: () => this.onSelect(item),
      });
      tile.mount(container);
    });

    if (this.hasMore) {
      const spinner = new LibrarySpinner();
      spinner.mount(container);
    }

    return container;
  }
}

export default VideoGallery;