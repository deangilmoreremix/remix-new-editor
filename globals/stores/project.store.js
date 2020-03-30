import { observable, action, computed, reaction } from 'mobx';
import arrayMove from 'array-move';

import BaseStore from './base.store';

import { EMAIL_SKIP_TOKENS } from '../../lib/constants/campaigns/constants';
import { SANTISECOND, MAX_ZINDEX } from '../../lib/constants/project';

const defaultLayer = {
  name: '',
  order: 0,
  trackEvents: [],
};

const defaultItem = {
  tags: [],
  title: '',
  background: '',
  description: '',
  allowedSocials: [],
  project: {
    data: {
      targets: [{
        id: 'Target0',
        name: 'video-container',
        element: 'video-container',
      }],
      media: [{
        id: 'Media0',
        name: 'Media0',
        url: '#t=,30',
        target: 'video',
        duration: 30,
        controls: false,
        tracks: [{
          name: '',
          id: '0',
          order: 0,
          trackEvents: [],
        }],
      }],
      template: 'basic',
      tags: [],
    },
  },
};

// TODO: remove the fake data when ready
const mockPersonalizations = ['FIRSTNAME', 'LASTNAME', 'GENDER', 'FIRSTNAME', 'GEOCOUNTRY'];

const PAUSE_PLUGIN_TIME_MARGIN = 0.5;

export default class ProjectStore extends BaseStore {
  constructor(props) {
    super(props);
    this.layers = [];
    this.elements = [];
    reaction(
      () => this.popcorn && this.popcorn.on,
      () => {
        this.popcorn.on('canplayall', () => {
          this.duration = (this.popcorn.duration() || 30) * SANTISECOND;
          this.isLoaded = true;
        });
        this.popcorn.on('timeupdate', () => {
          this.time = this.popcorn.currentTime() * SANTISECOND;
        });
        this.popcorn.on('ended', () => {
          this.time = 0;
          this.popcorn.currentTime(0);
        });

        this.popcorn.on('pause', () => {
          this.isPlayed = false;
        });
        this.popcorn.on('play', () => {
          this.isPlayed = true;
        });
      },
    );
  }

  @observable assets = [];

  @observable item = {};

  @observable isLoaded = false;

  @observable isPlayed = false;

  @observable projectData = {};

  @observable layers;

  @observable elements;

  @observable videoElements = [];

  @observable audioElements = [];

  @observable popcorn = {};

  @observable modified = false;

  // TODO: remove the fake data when ready
  @observable personalizations = new Set(
    mockPersonalizations.filter(token => !EMAIL_SKIP_TOKENS.includes(token)),
  );

  @observable duration = 30 * SANTISECOND;

  @observable time = 0;

  generateUid = () => `${Date.now()}/${Math.random()}`;

  @action
  setProjectData = (data) => {
    let layers = [];
    const elements = [];
    const projectData = data;
    projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents.forEach((trackEvent) => {
          if (trackEvent.type === 'pausePlugin') {
            trackEvent.popcornOptions.start = media.duration - PAUSE_PLUGIN_TIME_MARGIN;
            trackEvent.popcornOptions.end = media.duration;
          }
          elements.push({
            ...trackEvent,
          });
        });
        const layer = {
          name: track.name,
          defaultName: `Layer ${track.order}`,
          order: track.order,
          id: track.id,
        };
        layers.push(layer);
      });
      media.tracks = media.tracks.sort((a, b) => a.order - b.order);
    });
    layers = layers.sort((a, b) => a.order - b.order);
    this.layers = layers;
    this.elements = elements;
    this.projectData = projectData;
  };

  generatePopcornObject = () => {
    let popcornObject = {};
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
        popcornElements: [],
      };

      currentMedia.tracks.forEach((currentTrack) => {
        currentTrack.trackEvents.forEach((currentTrackEvent) => {
          popcornData.popcornElements.push({
            ...currentTrackEvent,
          });
        });
      });
      popcornObject = popcornData;
    });
    return popcornObject;
  };

  @computed
  get popcornObject() {
    return this.generatePopcornObject();
  }

  @action
  moveElements = (oldIndex, newIndex) => {
    this.modified = true;
    this.projectData.media.forEach((media) => {
      const topElements = media.tracks[oldIndex].trackEvents;
      const bottomElements = media.tracks[newIndex].trackEvents;
      const topZIndex = MAX_ZINDEX - media.tracks[oldIndex].order;
      const bottomZIndex = MAX_ZINDEX - media.tracks[newIndex].order;
      const tracks = arrayMove(media.tracks, oldIndex, newIndex);
      media.tracks = this.orderItems(tracks, true);
      topElements.forEach(element => {
        if (!this.isAudio(element)) {
          element.popcornOptions.zindex = topZIndex;
          this.update(element, { zindex: topZIndex });
        }
      });
      bottomElements.forEach(element => {
        if (!this.isAudio(element)) {
          element.popcornOptions.zindex = bottomZIndex;
          this.update(element, { zindex: bottomZIndex });
        }
      });
    });
    let newLayers = [...this.layers];
    newLayers = arrayMove(newLayers, oldIndex, newIndex);
    newLayers = this.orderItems(newLayers);
    this.layers = newLayers;
  };

  @action
  playPause = () => {
    if (!this.isLoaded) {
      return;
    }
    if (this.isPlayed) {
      this.popcorn.pause();
    } else {
      this.popcorn.play();
    }
  };

  @action
  orderItems = (items, updateTracks) => items.map((track, index) => {
    track.defaultName = `Layer ${index}`;
    if (updateTracks) {
      const zindex = MAX_ZINDEX - index;
      track.trackEvents.forEach(element => {
        this.update(element, { zindex });
      });
    }
    track.order = index;
    return track;
  });

  @action
  addLayer = () => {
    this.modified = true;
    this.projectData.media.forEach((media) => {
      media.tracks = media.tracks.map(track => {
        track.order += 1;
        const zindex = MAX_ZINDEX - track.order;
        track.trackEvents.forEach(element => {
          element.popcornOptions.zindex = zindex;
          this.update(element, { zindex });
        });
        return track;
      });
      media.tracks.unshift({ ...defaultLayer, id: media.tracks.length });
    });

    this.layers = this.layers.map(track => {
      track.order += 1;
      track.defaultName = `Layer ${track.order}`;
      return track;
    });
    this.layers.unshift({ ...defaultLayer, id: `${this.layers.length}`, defaultName: 'Layer 0' });
  };

  @action
  removeLayer = (id) => {
    if (this.layers.length <= 1) {
      return;
    }
    this.projectData.media.forEach((media) => {
      const removedTrack = media.tracks.find(track => track.id === id);
      if (removedTrack && removedTrack.trackEvents.length) {
        removedTrack.trackEvents.forEach((trackEvent) => {
          this.popcorn.removeTrackEvent(trackEvent.id);
        });
        this.elements = this.elements.filter(element => element.track !== id);
      }
      media.tracks = media.tracks.filter(track => track.id !== id);
      media.tracks = this.orderItems(media.tracks, true);
    });
    this.layers = this.layers.filter(track => track.id !== id);
    this.layers = this.orderItems(this.layers);
    this.elements = this.elements.filter(item => item.track !== id);
  };

  @action
  editLayer = (id, options) => {
    this.modified = true;
    this.projectData.media.forEach((media) => {
      media.tracks = media.tracks.map(track => {
        if (track.id === id) {
          track = { ...track, ...options };
        }
        return track;
      });
    });
    this.layers = this.layers.map(track => {
      if (track.id === id) {
        track = { ...track, ...options };
      }
      return track;
    });
  };

  @action
  removeElement(id) {
    this.modified = true;
    this.projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents = track.trackEvents.filter(trackEvent => trackEvent.id !== id);
        this.popcorn.removeTrackEvent(id);
      });
    });
  }

  @action
  setLayer = (elementId, newLayerLevel) => {
    let element;
    this.modified = true;
    const layer = this.layers.find(item => item.order === newLayerLevel);
    this.elements = this.elements.map(item => {
      if (item.id === elementId) {
        element = item;
        item.track = layer.id;
      }
      return item;
    });
    if (!element) {
      return;
    }
    this.projectData.media.forEach((media) => {
      media.tracks = media.tracks.map(track => {
        if (track.order === newLayerLevel) {
          track.trackEvents.push({ ...element, track: track.id });
        } else {
          track.trackEvents = track.trackEvents.filter(item => item.id !== elementId);
        }
        return track;
      });
    });
  };

  @action
  updateTime = (value) => {
    this.time = value;
    this.popcorn.currentTime(value / SANTISECOND);
  };

  @action
  updateStartEnd = (elementId, start, end) => {
    this.elements = this.elements.map(element => {
      if (element.id === elementId) {
        element.start = start;
        element.end = end;
      }
      return element;
    });
    this.projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents.forEach((trackEvent) => {
          if (trackEvent.id === elementId) {
            trackEvent.popcornOptions = { ...trackEvent.popcornOptions, ...{ start, end } };
          }
        });
      });
    });
    this.update(elementId, { start, end });
  };

  @action
  findAndUpdate = (element, options) => {
    const elementId = (element && element.id) || element;
    this.modified = true;
    this.projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents.forEach((trackEvent) => {
          if (trackEvent.id === elementId) {
            trackEvent.popcornOptions = { ...trackEvent.popcornOptions, options };
          }
        });
      });
    });
    this.update(elementId, options);
  };

  @action
    update = (element, options) => {
      const elementId = (element && element.id) || element;
      const trackEvent = this.popcorn.getTrackEvent(elementId);
      // eslint-disable-next-line no-underscore-dangle
      if (trackEvent && trackEvent._natives._update) {
        // _natives and _update is popcorn functions
        // eslint-disable-next-line no-underscore-dangle
        trackEvent._natives._update(trackEvent, options);
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
      this.setProjectData(this.item.project.data);
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
      this.setProjectData(JSON.parse(this.item.project.data));
    } catch (e) {
      this.item = defaultItem;
      this.setProjectData(this.item.project.data);
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
  };

  @action
  attach = (target) => {
    const findMediaSource = (sources, acceptableSources) => sources.filter((source) => {
      const extension = source.split('.').reverse()[0];
      return acceptableSources.some(extension);
    })[0];

    this.popcornObject.popcornElements.forEach((element) => {
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
  };

  @action
  save = async () => {
    try {
      const path = this.item.make
        ? `/api/users/me/makes/${this.item_id}`
        : '/api/users/me/makes';
      const serializedProject = this.item.serialize();
      this.item.make = await this.request(
        path, {
          method: this.item.make ? 'PATCH' : 'POST',
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
    } catch (e) {
      console.error('Error ', e);
    }
    return this.item;
  }
}
