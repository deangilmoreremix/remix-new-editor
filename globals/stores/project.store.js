import { observable, action } from 'mobx';

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

const PAUSE_PLUGIN_TIME_MARGIN = 0.5;

export default class ProjectStore extends BaseStore {
  constructor(props) {
    super(props);
    this.item = defaultItem;
  }

  @observable item = {};

  @observable projectData = {};

  @observable layers = [];

  @observable videoElements = [];

  @observable audioElements = [];

  @observable popcornObject = null;

  @observable popcorn = {};

  @observable modified = false;

  @observable duration = 0;

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
  setLayers = () => {
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
    this.layers = [];
    this.audioElements = [];
    this.videoElements = [];
    const layers = [];
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
          name: currentTrack.name || `Layer ${currentTrack.id}`,
          order: currentTrack.order,
          elements: [],
        };
        currentTrack.trackEvents.forEach((currentTrackEvent) => {
          popcornData.elements.push({
            type: currentTrackEvent.type,
            popcornOptions: currentTrackEvent.popcornOptions,
          });
          if (currentTrackEvent.type !== 'sequencer') {
            layer.elements.push({
              type: currentTrackEvent.type,
              popcornOptions: currentTrackEvent.popcornOptions,
            });
          } else if (this.isVideo(currentTrackEvent)) {
            this.videoElements.push(currentTrackEvent.popcornOptions);
          } else if (this.isAudio(currentTrackEvent)) {
            this.audioElements.push(currentTrackEvent.popcornOptions);
          }
        });
        if (layer.elements.length > 0) {
          layers.push(layer);
        }
      });
      this.popcornObject = popcornData;
      this.sortLayers(layers);
    });
  };

  @action
  sortLayers = (items, isModify) => {
    this.layers = items;
    this.layers.map((layer, index) => {
      layer.order = index;
      return layer;
    });
    if (isModify && !this.modified) {
      this.modified = true;
    }
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
      if (this.layers.length === 0) {
        this.layers.push(defaultLayer);
      }
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
  }

  @action
  attach = (target) => {
    const findMediaSource = (sources, acceptableSources) => sources.filter((source) => {
      const extension = source.split('.').reverse()[0];
      return acceptableSources.indexOf(extension) !== -1;
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
  }
}
