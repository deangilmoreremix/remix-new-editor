import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import classnames from 'classnames';
import mediaConstants from '../../../lib/constants/media.js';
import { showError } from '../../../lib/services/alertService.js';
import { perPage } from '../../../lib/constants/library.js';
import { MEDIA_TYPES } from '../../../lib/constants/popcorn.js';
import plusIcon from '../../../public/static/svgImages/plus-circle.svg';
import ContentItem from './ContentItem.js';
import LottieItem from '../../../lib/lottie/LottieItem.js';

export class Content extends Component {
  constructor(props = {}) {
    super(props);
    this.uiStore = getStore('uiStore');
    this.userStore = getStore('userStore');
    this.mediaStore = getStore('mediaStore');
    this.projectStore = getStore('projectStore');

    this.state = {
      isLoading: false,
      items: [],
      uploadedItems: [],
      pageNumber: 1,
      hasMore: true,
      isFirstFetch: true,
      newLottieElements: null,
      filesToUpload: null,
    };

    this.handleDrop = this.handleDrop.bind(this);
    this.handleDragOver = this.handleDragOver.bind(this);
    this.handleDragLeave = this.handleDragLeave.bind(this);
    this.onSelect = this.onSelect.bind(this);
    this.onDelete = this.onDelete.bind(this);
    this.fetchItems = this.fetchItems.bind(this);
    this.bulkDeleteItems = this.bulkDeleteItems.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
  }

  onMount() {
    this.subscribeToStore(this.uiStore, () => this.updateFromUI());
    this.subscribeToStore(this.userStore, () => this.forceUpdate());
    this.subscribeToStore(this.mediaStore, () => this.forceUpdate());
    this.subscribeToStore(this.projectStore, () => this.forceUpdate());
    this.fetchItems(this.uiStore.getState().secondaryWindowType);
  }

  onUnmount() {
    if (this.mediaStore.getState().presetsItemsForDelete.length) {
      this.bulkDeleteItems(true);
    }
  }

  updateFromUI() {
    const { secondaryWindowType: activeTab } = this.uiStore.getState();
    if (activeTab !== this.currentTab) {
      this.currentTab = activeTab;
      this.setState({
        isFirstFetch: true,
        items: [],
        pageNumber: 1,
        uploadedItems: [],
      });
      if (this.mediaStore.getState().presetsItemsForDelete.length) {
        this.bulkDeleteItems();
      } else {
        this.fetchItems(activeTab);
      }
    }
    this.forceUpdate();
  }

  async fetchItems(currentTab) {
    if (!currentTab && this.state.isFirstFetch) {
      return;
    }

    this.setState({ isFirstFetch: false });
    let currentPage = 0;
    let uploaded = [];

    if (currentTab) {
      this.setState({ pageNumber: 1, uploadedItems: [] });
      currentPage = 1;
    } else {
      currentPage = this.state.pageNumber + 1;
      this.setState({ pageNumber: currentPage });
      uploaded = this.state.uploadedItems;
    }

    try {
      const data = await this.mediaStore.getState().getPresets(currentTab, currentPage, { _id: { $nin: uploaded } });

      if (data.length) {
        this.setState({ items: [...this.state.items, ...data] });
      }
      this.setState({ hasMore: data && data.length === perPage });
    } catch (e) {
      showError('An error occurred while loading items');
    }
  }

  async bulkDeleteItems(unmount) {
    try {
      await this.mediaStore.getState().deletePreset();
      if (!unmount) {
        this.setState({ items: [] });
        this.fetchItems(this.uiStore.getState().secondaryWindowType);
      }
    } catch (e) {
      showError(`Error while deleting items, ${e.message}`);
    }
  }

  handleDrop(e) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file => 
      mediaConstants.JSON_CONTENT_TYPE.includes(file.type)
    );
    if (files.length) {
      this.setState({ isLoading: true, newLottieElements: files });
      this.processFiles(files);
    }
  }

  handleDragOver(e) {
    e.preventDefault();
    // Add active class
    const dropZone = e.currentTarget;
    dropZone.classList.add('stickers-content__add--active');
  }

  handleDragLeave(e) {
    e.preventDefault();
    // Remove active class
    const dropZone = e.currentTarget;
    dropZone.classList.remove('stickers-content__add--active');
  }

  async processFiles(files) {
    try {
      const elements = [];
      const elementsIds = [];
      
      for (const data of files) {
        const assetJson = await this.mediaStore.getState().uploadMedia({ data });

        const previewFile = await fetch(data.preview || URL.createObjectURL(data))
          .then(res => res.blob())
          .then(blob => new File([blob], data.name, { type: 'image/png' }));

        const assetPreview = await this.mediaStore.getState().uploadMedia({ data: previewFile });

        const item = await this.mediaStore.getState().addPreset({ data: assetJson.url, preview: assetPreview.url }, this.uiStore.getState().secondaryWindowType);
        elements.push(item);
        elementsIds.push(item._id);
      }

      this.setState({
        items: [...elements, ...this.state.items],
        uploadedItems: [...this.state.uploadedItems, ...elementsIds],
        isLoading: false,
        newLottieElements: null,
        filesToUpload: null,
      });
    } catch (e) {
      showError(e.message);
      this.setState({ isLoading: false, newLottieElements: null, filesToUpload: null });
    }
  }

  onSelect(item) {
    item.src = item.data;
    item.type = MEDIA_TYPES.LOTTIE_JSON;
    this.projectStore.getState().addElement(item);
  }

  onDelete(id) {
    const newItems = this.state.items.filter(item => item._id !== id);
    this.mediaStore.setState({ presetsForDelete: [...this.mediaStore.getState().presetsForDelete, id] });
    this.setState({ items: newItems });
  }

  handleScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 100 && this.state.hasMore) {
      this.fetchItems();
    }
  }

  render() {
    const { isSuperAdmin } = this.userStore.getState();
    const { isLoading, items, newLottieElements, hasMore } = this.state;

    const itemsHtml = items.map(item => {
      const contentItem = new ContentItem({
        item,
        onDelete: this.onDelete,
        onSelect: this.onSelect
      });
      return contentItem.render().outerHTML;
    }).join('');

    const lottieHtml = newLottieElements && newLottieElements.length > 0 ? 
      new LottieItem({
        items: newLottieElements,
        setFilesToUpload: (files) => this.setState({ filesToUpload: files }),
        isReady: Boolean(this.state.filesToUpload && this.state.filesToUpload.length)
      }).render().outerHTML : '';

    const html = `
      <div class="stickers-content" style="overflow-y: auto;">
        ${isSuperAdmin ? `
          <div class="stickers-content__item stickers-content__add ${isLoading ? 'stickers-content__add--disabled' : ''}">
            <input type="file" accept="${mediaConstants.JSON_CONTENT_TYPE.join(',')}" multiple style="display: none;" />
            <div class="stickers-item-plus">${plusIcon}</div>
            ${lottieHtml}
          </div>
        ` : ''}
        ${itemsHtml}
      </div>
    `;

    const element = this.createElementFromHTML(html);
    this.setupEventListeners(element);
    return element;
  }

  setupEventListeners(element) {
    const dropZone = element.querySelector('.stickers-content__add');
    if (dropZone) {
      this.addEventListener(dropZone, 'drop', this.handleDrop);
      this.addEventListener(dropZone, 'dragover', this.handleDragOver);
      this.addEventListener(dropZone, 'dragleave', this.handleDragLeave);
    }

    const fileInput = element.querySelector('input[type="file"]');
    if (fileInput) {
      this.addEventListener(fileInput, 'change', (e) => {
        const files = Array.from(e.target.files);
        this.setState({ isLoading: true, newLottieElements: files });
        this.processFiles(files);
      });
    }

    const container = element.querySelector('.stickers-content');
    if (container) {
      this.addEventListener(container, 'scroll', this.handleScroll);
    }
  }
}

export default Content;