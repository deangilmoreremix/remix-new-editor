import { observable, action, computed, when } from 'mobx';

import BaseStore from './base.store';

const defaultItem = {
  tags: [],
  title: '',
  background: '',
  description: '',
  allowedSocials: [],
  project: {
    data: {},
  },
};
const defaultLayer = {
  name: 'Layer',
  id: 0,
  order: 0,
};

// todo add to global consts
const PAUSE_PLUGIN_TIME_MARGIN = 0.5;

export default class ProjectStore extends BaseStore {
  constructor(props) {
    super(props);
    this.item = defaultItem;
    when(
      () => this.popcorn && this.popcorn.on,
      () => {
        this.popcorn.on('canplayall', () => {
          this.duration = this.popcorn.duration();
          this.isLoaded = true;
        });
      },
    );
  }

  @observable assets = [];

  @observable item = {};

  @observable isLoaded = false;

  @observable projectData = {};

  @observable layers = [];

  @observable videoElements = [];

  @observable audioElements = [];

  @observable popcornObject = null;

  @observable popcorn = {};

  @observable modified = false;

  @observable duration = 30;

  @observable
  engines = [];

  @action
  setProjectData = () => {
    this.projectData = JSON.parse(this.item.project.data);
    this.projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents.forEach((trackEvent) => {
          if (trackEvent.type === 'pausePlugin') {
            trackEvent.popcornOptions.start = media.duration - PAUSE_PLUGIN_TIME_MARGIN;
            trackEvent.popcornOptions.end = media.duration;
          }
        });
      });
    });
  };

  @action
  makeOut = () => {
    const layers = [];
    this.audioElements = [];
    this.videoElements = [];
    this.projectData.media.forEach((currentMedia) => {
      // We expect a string (one url) or an array of url strings.
      // Turn a single url into an array of 1 string.
      const mediaUrls = typeof currentMedia.url === 'string' ? [currentMedia.url] : currentMedia.url;
      const mediaUrlsString = `[ '${mediaUrls.join('')}' ]`;

      const mediaPopcornOptions = currentMedia.popcornOptions || {};
      // Force the Popcorn instance we generate to have an ID we can query.
      mediaPopcornOptions.id = 'Butter-Generated';

      const popcornData = {
        target: currentMedia.target,
        mediaUrlsString,
        elements: [],
      };

      currentMedia.tracks.forEach((currentTrack) => {
        const layer = {
          name: currentTrack.name,
          defaultName: `Layer ${currentTrack.order}`,
          order: currentTrack.order,
          id: currentTrack.id,
        };
        currentTrack.trackEvents.forEach((currentTrackEvent) => {
          popcornData.elements.push({
            type: currentTrackEvent.type,
            popcornOptions: currentTrackEvent.popcornOptions,
            order: layer.order,
            layerId: layer.id,
          });
        });
        layers.push(layer);
      });
      this.sortLayers(layers);
      this.popcornObject = popcornData;
    });
  };

  @computed
  get elements() {
    return (this.popcornObject && this.popcornObject.elements) || [];
  }

  @action
  setLayers = (items, isModify) => {
    this.layers = items;
    if (isModify && !this.modified) {
      this.modified = true;
    }
  };

  @action
  sortLayers = (items) => {
    this.layers = (items || this.layers).sort((a, b) => a.order - b.order);
  };

  @action
  updateOrders = (items) => {
    this.layers = (items || this.layers).map((layer, index) => {
      layer.order = index;
      layer.defaultName = `Layer ${index}`;
      this.popcornObject.elements = this.popcornObject.elements.map(element => {
        if (element.layerId === layer.id) {
          element.order = index;
        }
        return element;
      });
      return layer;
    });
  };

  @action
  setLayer = (elementId, newLayerLevel) => {
    const newLayer = this.layers.find(layer => layer.order === newLayerLevel);
    this.popcornObject.elements = this.elements.map(element => {
      if (element.id === elementId) {
        element.layerId = newLayer.id;
        element.order = newLayer.order;
      }
      return element;
    });
  };

  @action
  updateStartEnd = (elementId, start, end) => {
    this.popcornObject.elements = this.elements.map(element => {
      if (element.id === elementId) {
        element.start = start;
        element.end = end;
      }
      return element;
    });
  };

  isVideo = (element) => !!((element.popcornOptions.type === 'YouTube'
        || element.popcornOptions.type === 'Vimeo') || (element.popcornOptions.contentType
        && element.popcornOptions.contentType.indexOf('video/') === 0));

  isAudio = (element) => !!((element.popcornOptions.type === 'SoundCloud')
    || (element.popcornOptions.contentType
      && (element.popcornOptions.contentType.indexOf('audio/') === 0
      || element.popcornOptions.contentType.indexOf('application/ogg') === 0)));


  @action
  getOne = async (projectId) => {
    if (!projectId) {
      this.item = defaultItem;
      this.projectData = {};
      return this.item;
    }
    const path = `/api/users/me/makes/${projectId}`;
    try {
      this.item = await this.request(
        path, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
      this.setProjectData();
      this.makeOut();
      // if (this.layers.length === 0) {
      //   this.layers.push(defaultLayer);
      // }
    } catch (e) {
      this.item = defaultItem;
      throw e;
    }
    return this.item;
  };

  @action
  setPopcorn = (target) => {
    if (!this.popcornObject) {
      return;
    }

    this.popcorn = window.Popcorn.smart(target,
      this.popcornObject.mediaUrlsString, this.popcornObject.mediaPopcornOptions);

    this.attach(target);
    this.engines.push(this.popcorn);
  };

  @action
  attach = (target) => {
    const findMediaSource = (sources, acceptableSources) => sources.filter((source) => {
      const extension = source.split('.').reverse()[0];
      return acceptableSources.some(extension);
    })[0];

    this.popcornObject.elements.forEach((element) => {
      if (element.type === 'sequencer' && element.popcornOptions.source[0].split('|').length > 1) {
        element.popcornOptions.source = [findMediaSource(
          element.popcornOptions.source[0].split('|'), ['mp4', 'webm'],
        )];
      }
      this.popcorn[element.type](target
        ? { ...element.popcornOptions, target }
        : element.popcornOptions);
    });
    this.popcorn.target = target;
    return this.popcorn;
  };

  @action
  updateItem = (value) => {
    this.item = { ...this.item, ...value };
  };

  @action
  addAsset = (asset) => {
    this.assets.push(asset);
  };

  @action
  serialize() {
    return {
      data: JSON.stringify(this.item),
      allowedSocials: this.item.allowedSocials,
      name: this.item.name,
      editor: 'smart-video',
      description: this.item.description,
      thumbnail: this.item.thumbnail,
      source: this.item.source,
    };
  }

  @action
  save = async () => {
    // TODO: should be refactored in https://app.asana.com/0/1134020730337032/1154072706347831
    try {
      const path = this.item
        ? `/api/users/me/makes/${this.item._id}`
        : '/api/users/me/makes';
      const serializedProject = this.serialize();
      this.item = await this.request(
        path, {
          method: this.item ? 'PATCH' : 'POST',
          headers: {
            'on-behalf': this.currentUser.id,
          },
          body: {
            title: serializedProject.name,
            description: serializedProject.description,
            project: serializedProject,
            thumbnail: serializedProject.thumbnail,
            remixedFrom: serializedProject.source,
          },
        });
      this.modified = false;
      return this.item;
    } catch (e) {
      console.error(e);
    }
  };
}
