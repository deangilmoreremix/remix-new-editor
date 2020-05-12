import { observable, action, computed, reaction, runInAction } from 'mobx';
import arrayMove from 'array-move';
import size from 'lodash/size';

import BaseStore from './base.store';
import { emitter, emitterActions } from '../../lib/mitt/emitter';
import blendModeConstants from '../../lib/constants/blendMode';

import { SEQUENCER } from '../../lib/constants/popcorn';
import { isLayerFulfilled } from '../../lib/utils/project';
import { NONE_CLASS } from '../../lib/constants/animations';
import {
  SANTISECOND,
  MAX_ZINDEX,
  DEFAULT_CONTAINER,
  DEFAULT_DURATION,
  PAUSE_PLUGIN_TIME_MARGIN,
  DEFAULT_LAYER,
  DEFAULT_ITEM,
} from '../../lib/constants/project';

import MediaTypeDetector from '../../lib/utils/mediaTypeDetector';
import { getCustomVarsFromMediaArr } from '../../lib/utils/tokens-helper';

export default class ProjectStore extends BaseStore {
  @observable activeElementId;

  @observable assets = [];

  @observable item = {};

  @observable isLoaded = false;

  @observable isPlayed = false;

  @observable isLoading = false;

  @observable projectData = {};

  @observable layers;

  @observable elements = [];

  @observable videoElements = [];

  @observable audioElements = [];

  @observable popcorn = {};

  @observable modified = false;

  getPersonalization = () => getCustomVarsFromMediaArr(this.projectData.media);

  generateUid = () => `${Date.now() / Math.random()}`;

  @observable duration = 30 * SANTISECOND;

  @observable time = 0;

  deleteItem = emitter.on(emitterActions.DELETE, id => {
    this.removeElement(id);
  });

  setElementOptions = async (item) => {
    const options = {};
    options.start = item.start || (this.time / SANTISECOND);
    options.end = item.end || options.start + DEFAULT_DURATION;
    options.id = `0.${this.generateUid()}`;
    options.zindex = MAX_ZINDEX;

    switch (item.type) {
      case SEQUENCER: {
        const source = (item.extra && item.extra.source) || [item.url];
        const videoMeta = await this.mediaTypeDetector.getMetadata(source[0]);
        options.end = options.start + videoMeta.duration;
        options.source = source;
        options.title = videoMeta.title;
        options.duration = videoMeta.duration;
        options.from = 0;
        options.contentType = videoMeta.contentType;
        options.in = options.start;
        options.out = options.end;
        break;
      }
      default:
        break;
    }
    return options;
  };

  @action
  addElement = async (item) => {
    const { type } = item;

    if (this.isPlayed) {
      this.playPause();
    }

    const options = await this.setElementOptions(item);

    // get first track
    let track = item.track || this.layers[0];
    const layerElements = this.elements.filter(element => element.track === track.id);
    if (isLayerFulfilled(options, layerElements)) {
      this.addLayer();
      [track] = this.layers;
    }

    const element = {
      id: options.id,
      type,
      track: track.id,
      name: options.id,
      popcornOptions: { ...item, ...options },
    };

    this.addElementToProject(element);

    // update duration
    if (options.end > this.duration / SANTISECOND) {
      this.recompressProject(options.end);
      this.setPopcorn(this.popcorn.target);
      this.duration = options.end * SANTISECOND;
    }

    // update timeline
    this.elements = [element, ...this.elements];

    this.editElement(element.id);
  };

  @action
  editElement = (elementId) => {
    this.activeElementId = elementId;
  };

  @action
  releaseElement = () => {
    this.activeElementId = null;
  };

  @action
  findAndUpdate = (elementId, options) => {
    this.modified = true;
    this.projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents = track.trackEvents.map((trackEvent) => {
          if (trackEvent.id === elementId) {
            trackEvent.popcornOptions = { ...trackEvent.popcornOptions, ...options };
          }
          return trackEvent;
        });
      });
    });
    this.updateElement(elementId, options);
    this.updatePopcorn(elementId, options);
  };

  @action
  updateElement = (elementId, options) => {
    // we need to update the elements, if the user updates the start,
    // end or animation, this is necessary to rerender the elements
    const { start, end, animation, title } = options;
    this.elements = this.elements.map(element => {
      if (element.id === elementId) {
        const newOptions = {};
        if (start !== undefined && start !== element.popcornOptions.start) {
          newOptions.start = start;
        }
        if (end !== undefined && end !== element.popcornOptions.end) {
          newOptions.end = end;
        }
        if (animation) {
          newOptions.animation = animation;
        }
        if (title) {
          newOptions.title = title;
        }
        if (size(newOptions) > 0) {
          element.popcornOptions = {
            ...element.popcornOptions,
            ...newOptions,
          };
        }
      }
      return element;
    });
  };

  @action
  findElement = (elementId) => {
    let element = null;
    this.projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents.forEach((trackEvent) => {
          if (trackEvent.id === elementId) {
            element = trackEvent;
          }
        });
      });
    });
    return element;
  };

  @action
  updatePopcorn = (element, options) => {
    const elementId = (element && element.id) || element;
    element = typeof element === 'string' ? this.getElementById(elementId) : element;

    // need rewrite element, if user update the start or end field
    if ((options.start !== undefined && (element.popcornOptions.start !== options.start))
      || (options.end !== undefined && (element.popcornOptions.end !== options.end))) {
      this.popcorn.removeTrackEvent(elementId);
      element.popcornOptions = { ...element.popcornOptions, ...options };
      this.popcorn[element.type](element.popcornOptions);
    } else {
      const trackEvent = this.popcorn.getTrackEvent(elementId);
      // eslint-disable-next-line no-underscore-dangle
      if (trackEvent && trackEvent._natives._update) {
        // _natives and _update is popcorn functions
        // eslint-disable-next-line no-underscore-dangle
        trackEvent._natives._update(trackEvent, options);
      }
    }
  };

  updateAnimation = (type, animationName = NONE_CLASS) => {
    const oldAnimation = this.element && this.element.popcornOptions.animation;
    const animation = {
      ...(oldAnimation ? { ...oldAnimation } : {}),
      [type]: {
        type: animationName,
        // The animated class has a default speed of 1s
        duration: 1,
      },
    };
    this.findAndUpdate(this.activeElementId, { animation });
  };

  @action
  setPopcorn = (target) => {
    if (!this.popcornObject) {
      return;
    }
    if (!target) {
      target = this.popcorn.target;
    }
    this.popcorn = window.Popcorn.smart(target,
      this.popcornObject.mediaUrlsString, this.popcornObject.mediaPopcornOptions);
    this.attach(target);
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
          blendMode: track.blendMode,
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

  @computed
  get popcornObject() {
    return this.generatePopcornObject();
  }

  @action
  moveElements = (oldIndex, newIndex) => {
    this.projectData.media.forEach((media) => {
      const tracks = arrayMove(media.tracks, oldIndex, newIndex);
      media.tracks = this.orderItems(tracks, true);
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
        this.updatePopcorn(element, { zindex });
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
          this.updatePopcorn(element, { zindex });
        });
        return track;
      });
      media.tracks.unshift({ ...DEFAULT_LAYER, id: `${media.tracks.length}` });
    });

    this.layers = this.layers.map(track => {
      track.order += 1;
      track.defaultName = `Layer ${track.order}`;
      return track;
    });
    this.layers.unshift({ ...DEFAULT_LAYER, id: `${this.layers.length}`, defaultName: 'Layer 0' });
  };

  @action
  removeElement = (id) => {
    this.modified = true;
    this.releaseElement();
    if (this.projectData.media) {
      this.projectData.media.forEach((media) => {
        media.tracks.forEach((track) => {
          track.trackEvents = track.trackEvents.filter(trackEvent => trackEvent.id !== id);
          this.popcorn.removeTrackEvent(id);
        });
      });

      this.elements = this.elements.filter(element => element.id !== id);
    }
  };

  @action
  removeLayer = (id) => {
    if (this.layers.length <= 1) {
      return;
    }
    this.modified = true;
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
  setLayer = (elementId, newLayerLevel) => {
    let element;
    this.modified = true;
    const layer = this.layers.find(item => item.order === newLayerLevel);
    this.elements = this.elements.map(item => {
      if (item.id === elementId) {
        element = item;
        item.track = layer.id;
        item.popcornOptions.blendMode = layer.blendMode;
        if (layer.blendMode) {
          this.updatePopcorn(item, { blendMode: layer.blendMode });
        } else {
          this.updatePopcorn(item, { blendMode: blendModeConstants.normal.value });
        }
      }
      return item;
    });
    if (!element) {
      return;
    }
    this.projectData.media.forEach((media) => {
      media.tracks = media.tracks.map(track => {
        if (track.order === newLayerLevel) {
          const zindex = MAX_ZINDEX - track.order;
          const { blendMode } = element.popcornOptions;
          element.track = track.id;
          element.popcornOptions.zindex = zindex;
          track.trackEvents.push(element);
          this.updatePopcorn(element, { zindex, blendMode });
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
    return this.popcorn.currentTime((value && value / SANTISECOND) || 0);
  };

  @action
  updateStartEnd = (elementId, start, end) => {
    this.elements = this.elements.map(element => {
      if (element.id === elementId) {
        element.popcornOptions.start = start;
        element.popcornOptions.end = end;
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
    this.updatePopcorn(elementId, { start, end });
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
      this.modified = true;
      this.item = DEFAULT_ITEM;
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
      this.item = DEFAULT_ITEM;
      this.setProjectData(this.item.project.data);
      throw e;
    }
    return this.item;
  };

  @action
  remixOne = async (projectId) => {
    if (!projectId) {
      this.modified = true;
      this.item = DEFAULT_ITEM;
      this.setProjectData(this.item.project.data);
      return this.item;
    }
    const path = `/api/makes/${projectId}/remix`;
    try {
      this.item = await this.request(
        path, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
      this.modified = true;
      this.item.title = `Remix of ${this.item.title}`;
      this.item.remixedFrom = this.item.project._id;
      this.remixedFromUrl = `${window.location.protocol}//${this.common.self}/edit?project=${this.item._id}`;
      this.setProjectData(JSON.parse(this.item.project.data));
    } catch (e) {
      this.item = DEFAULT_ITEM;
      this.setProjectData(this.item.project.data);
      throw e;
    }
    return this.item;
  };

  @computed
  get form() {
    if (!this.activeElementId) {
      return null;
    }
    const element = this.popcorn.getTrackEvent(this.activeElementId);

    if (!element) {
      return null;
    }
    // eslint-disable-next-line no-underscore-dangle
    const { options } = element._natives.manifest;
    const resultOptions = {};
    if (options) {
      Object.keys(options).forEach((fieldName) => {
        if (!options[fieldName].hidden) {
          resultOptions[fieldName] = options[fieldName];
        }
      });
    }
    return resultOptions;
  }

  findMediaSource = (sources, acceptableSources) => sources.filter((source) => {
    const extension = source.split('.').reverse()[0];
    return acceptableSources.includes(extension);
  })[0];

  @action
  attach = (target) => {
    this.popcornObject.popcornElements.forEach((element) => {
      if (element.type === 'sequencer' && element.popcornOptions.source[0].split('|').length > 1) {
        element.popcornOptions.source = [this.findMediaSource(
          element.popcornOptions.source[0].split('|'), ['mp4', 'webm', 'ogv'],
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
    this.modified = true;
    this.item = { ...this.item, ...value };
  };

  @action
  addAsset = (asset) => {
    this.assets.push(asset);
  };

  @action
  serializeProject = () => ({
    data: JSON.stringify(this.projectData),
    allowedSocials: this.item.allowedSocials,
    name: this.item.title,
    editor: 'revolution',
    description: this.item.description,
    thumbnail: this.item.thumbnail,
    source: this.item.source,
    tags: this.item.tags,
  });

  trailisePauseElements = (projectData) => {
    projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents.forEach((trackEvent) => {
          if (trackEvent.type === 'pausePlugin') {
            trackEvent.popcornOptions.start = media.duration - PAUSE_PLUGIN_TIME_MARGIN;
            trackEvent.popcornOptions.end = media.duration;
          }
        });
      });
    });
    return projectData;
  };

  // todo implement
  @action
  recompressProject = (newDuration) => {
    this.projectData.media.forEach((media) => {
      const initialDuration = media.duration;
      if (initialDuration === newDuration) {
        return;
      }
      media.duration = newDuration;
      media.url = `#t=,${newDuration}`;
      const recompressRatio = newDuration / initialDuration;
      media.tracks.forEach((track) => {
        track.trackEvents.forEach((trackEvent) => {
          if (trackEvent.type !== 'sequencer') {
            trackEvent.popcornOptions.start = Math
              .round(trackEvent.popcornOptions.start * recompressRatio * 100) / 100;
            trackEvent.popcornOptions.end = Math
              .round(trackEvent.popcornOptions.end * recompressRatio * 100) / 100;
          }
        });
      });
    });
    this.projectData = this.trailisePauseElements(this.projectData);
  };

  @action
  addElementToProject = (trackEvent) => {
    const { id, popcornOptions, type } = trackEvent;
    if (!popcornOptions.target) {
      popcornOptions.target = DEFAULT_CONTAINER;
    }
    this.popcorn[type]({ id, ...popcornOptions });
    this.projectData.media.forEach((media) => {
      media.tracks[0].trackEvents.push(trackEvent);
    });
  };

  @action
  save = async () => {
    if (!this.modified) {
      return;
    }
    this.isLoading = true;
    try {
      const path = this.item._id
        ? `/api/users/me/makes/${this.item._id}`
        : '/api/users/me/makes';
      const serializedData = this.serializeProject();
      const result = await this.request(
        path, {
          method: this.item._id ? 'PATCH' : 'POST',
          headers: {
            'on-behalf': this.currentUser.id,
          },
          body: {
            ...this.item,
            title: serializedData.name,
            description: serializedData.description,
            project: serializedData,
            thumbnail: serializedData.thumbnail,
            remixedFrom: serializedData.source,
            tags: serializedData.tags,
          },
        });
      const publishedMake = await this.publish(result._id);
      runInAction(() => {
        this.item = { ...this.item, ...result };
        this.item.contentUrl = publishedMake.contenturl;
        this.setProjectData(JSON.parse(this.item.project.data));
        this.modified = false;
        this.isLoading = false;
      });
    } catch (e) {
      this.isLoading = false;
      console.error('Error ', e);
      throw e;
    }
    return this.item;
  };

  @action
  invalidateFbCache = (url) => this.request(
    '/api/makes/update-fb-cache', {
      method: 'POST',
      headers: {
        'on-behalf': this.currentUser.id,
      },
      body: { publishUrl: url },
    });

  @computed
  get element() {
    if (!this.activeElementId) {
      return null;
    }
    return this.popcornElements.find(element => element.id === this.activeElementId);
  }

  getElementById(id) {
    return this.popcornElements.find(element => element.id === id);
  }

  @action
  runTextfill = () => {
    this.popcornElements.forEach(element => {
      const currentTime = this.time / SANTISECOND;
      const isCurrentElement = (element.popcornOptions.start <= currentTime)
        && (currentTime <= element.popcornOptions.end);
      if (isCurrentElement && element.popcornOptions.fontDecorations
        && element.popcornOptions.fontDecorations.responsive) {
        // we need to recount the fontsize. This is done in the update method.
        this.updatePopcorn(element, { fontDecorations: element.popcornOptions.fontDecorations });
      }
    });
  };

  publish(id) {
    return this.request(
      `/api/users/me/makes/${id}/publish`, {
        method: 'POST',
        headers: {
          'on-behalf': this.currentUser.id,
        },
      });
  }

  constructor(props) {
    super(props);
    this.layers = [];
    this.elements = [];
    this.mediaTypeDetector = new MediaTypeDetector();
    reaction(
      () => this.popcorn,
      () => {
        if (!this.popcorn.on) {
          return;
        }
        this.popcorn.on('canplayall', () => {
          this.duration = (this.popcorn.duration() || 30) * SANTISECOND;
          this.isLoaded = true;
        });
        this.popcorn.on('elementUpdated', (data) => {
          const { element, options } = data;
          this.findAndUpdate(element.id, options);
        });
        this.popcorn.on('elementSelected', ({ element }) => {
          this.editElement(element.id);
        });
        this.popcorn.on('timeupdate', () => {
          this.time = this.popcorn.currentTime() * SANTISECOND;
        });
        this.popcorn.on('ended', () => {
          this.time = 0;
          this.updateTime(0);
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

  @computed
  get popcornElements() {
    return this.popcornObject.popcornElements;
  }

  @action
  setBlendMode = (layerId, blendMode) => {
    this.modified = true;
    const elements = this.popcornElements.filter(element => element.track === layerId);
    elements.forEach(element => {
      this.updatePopcorn(element, { blendMode });
    });

    this.layers = this.layers.map(layer => {
      if (layer.id === layerId) {
        layer.blendMode = blendMode;
      }
      return layer;
    });

    this.projectData.media.forEach((media) => {
      media.tracks = media.tracks.map((track) => {
        if (track.id === layerId) {
          track.blendMode = blendMode;
        }
        track.trackEvents.forEach(trackEvent => {
          if (trackEvent.track === layerId) {
            trackEvent.popcornOptions.blendMode = blendMode;
            this.updatePopcorn(trackEvent, { blendMode });
          }
        });
        return track;
      });
    });
  };
}
