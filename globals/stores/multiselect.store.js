import { action, observable } from 'mobx';
import Bb from 'bluebird';
import { POPCORN_ELEMENT_TYPES } from '../../lib/constants/popcorn';
import { MAX_DURATION, SANTISECOND } from '../../lib/constants/project';
import { showError } from '../../lib/services/alertService';

const maps = {
  video: 'selectedVideos',
  audio: 'selectedAudios',
  image: 'selectedImages',
};

export default class MultiselectStore {
  constructor(props) {
    this.projectStore = props.projectStore;
    this.userStore = props.userStore;
    this.mediaStore = props.mediaStore;
  }

  @observable selectedImages = new Map();

  @observable selectedVideos = new Map();

  @observable selectedAudios = new Map();

  @observable emptyCollections = true;

  @observable selectedItemsId = [];

  setOptions = async (item, type) => {
    switch (type) {
      case POPCORN_ELEMENT_TYPES.SEQUENCER: {
        const source = (item.extra && item.extra.source) || [item.url];
        const fileDuration = (item.extra && item.extra.duration) || null;
        try {
          const fileMeta = await this.projectStore
            .mediaTypeDetector
            .getMetadata(source[0], item.kind === 'audio' ? 'audio' : 'video', fileDuration,
              this.userStore.video360Enabled);
          item.duration = fileMeta.duration === Infinity ? 5 : fileMeta.duration;
          item.fileMeta = fileMeta;
          return item;
        } catch (e) {
          item.hasError = true;
          console.error(e);
          return;
        }
      }
      default: {
        item.duration = 5;
        return item;
      }
    }
  };

  @action
  addSelectedElement = async (item) => {
    const mapKey = maps[item.kind];
    const currentMap = this[mapKey];
    if (!currentMap) {
      return;
    }
    currentMap.set(item._id || item.id || item.source, item);
    this.emptyCollections = this.isCollectionsEmpty();
    this.addToArrayId(item._id);
  };

  addToArrayId = (id) => this.selectedItemsId.push(id);

  deleteFromArrayId = (id) => (this.selectedItemsId.filter(item => item !== id));

  @action
  getElementsWithNewOptions = (kind, end = 0, track) => {
    const mapKey = maps[kind];
    const selectedCollection = this[mapKey];
    const elements = [];
    selectedCollection.forEach((item) => {
      if (item.hasError) {
        return showError(`This element ${item.title} has not been added!`);
      }
      if (end * SANTISECOND >= MAX_DURATION) {
        return showError('This file is too large');
      }
      item.track = track;
      if (!end) {
        item.start = this.projectStore.time / SANTISECOND || 0;
      } else {
        item.start = end + 0.01;
      }
      let newEnd = item.start + (item.duration || 5);
      newEnd = newEnd * SANTISECOND >= MAX_DURATION ? MAX_DURATION : newEnd;
      item.end = newEnd;
      ({ end } = item);
      elements.push(item);
    });
    return elements;
  };

  @action
  removeSelectedVideosAfterReset = (integrationType) => {
    if (!this.selectedVideos) {
      return;
    }
    this.selectedVideos.forEach(item => {
      if (item.integrationType === integrationType) {
        this.deleteSelectedElement(item);
        this.selectedItemsId = this.deleteFromArrayId(item._id || item.id || item.source);
      }
    });
    this.emptyCollections = this.isCollectionsEmpty();
  }

  @action
  deleteSelectedElement = (item) => {
    const mapKey = maps[item.kind];
    const currentMap = this[mapKey];
    if (!currentMap) {
      return;
    }
    currentMap.delete(item._id || item.id || item.source);
    this.emptyCollections = this.isCollectionsEmpty();
    this.selectedItemsId = this.deleteFromArrayId(item._id || item.id || item.source);
  };

  @action
  isCollectionsEmpty = () => {
    if (this.selectedImages.size
      || this.selectedAudios.size
      || this.selectedVideos.size) {
      return false;
    }
    return true;
  };

  @action
  clearAllSelectedItems = () => {
    this.selectedImages.clear();
    this.selectedVideos.clear();
    this.selectedAudios.clear();
    this.selectedItemsId = [];
    this.emptyCollections = true;
  };

  @action
  isItemPresent = (item) => {
    const mapKey = maps[item.kind];
    const currentMap = this[mapKey];
    if (!currentMap) {
      return;
    }
    return currentMap.has(item._id || item.id || item.source);
  };

  toArray = (collection) => {
    const arr = [];
    collection.forEach(value => {
      arr.push(value);
    });
    return arr;
  };

  @action
  addAllSelectedItems = async () => {
    let maxEnd = 0;
    let selectedElements = [];
    let promises = [];
    if (this.selectedVideos.size) {
      promises = promises.concat(Bb
        .map(this.selectedVideos.values(), (item) => this.setOptions(item,
          POPCORN_ELEMENT_TYPES.SEQUENCER)));
    }
    if (this.selectedAudios.size) {
      promises = promises.concat(Bb
        .map(this.selectedAudios.values(), (item) => this.setOptions(item,
          POPCORN_ELEMENT_TYPES.SEQUENCER)));
    }
    if (this.selectedImages.size) {
      promises = promises.concat(Bb
        .map(this.selectedImages.values(), (item) => (
          item.needUpload && this.mediaStore.uploadImageUrl(item)
        )),
      );
    }
    try {
      await Bb.all(promises);
      Object.entries(maps).forEach(([key, mapKey]) => {
        if (this[mapKey].size) {
          const { track, end } = this.projectStore.findLayerForType(key);
          const elements = this.getElementsWithNewOptions(key, end, track);
          if (selectedElements.length) {
            selectedElements = [...elements, ...selectedElements];
          } else {
            selectedElements = [...elements];
          }
          const lastElementEnd = elements[elements.length - 1].end;
          if (lastElementEnd > maxEnd) {
            maxEnd = lastElementEnd;
          }
        }
      });
      this.clearAllSelectedItems();
      return this.projectStore.createNewElements(selectedElements, maxEnd);
    } catch (e) {
      console.error(e);
    }
  }
}
