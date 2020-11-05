import { observable, action, computed, reaction, runInAction, toJS } from 'mobx';
import arrayMove from 'array-move';
import size from 'lodash/size';
import Bb from 'bluebird';

import Router from 'next/router';
import BaseStore from './base.store';
import { emitter, emitterActions } from '../../lib/mitt/emitter';
import blendModeConstants from '../../lib/constants/blendMode';
import { ASSET_TYPES } from '../../lib/constants/media';
import { GOOGLE_MAP_VALUES } from '../../lib/constants/googleMap';
import preRemixVoice from '../../lib/constants/preRemixVoice';
import { PRE_REMIX_VOICE_MODAL } from '../../lib/constants/modals';

import {
  SEQUENCER,
  POPCORN_ELEMENT_TYPES,
  CARET_NAMES,
  SOCIAL_TYPES,
  ELEMENTS,
} from '../../lib/constants/popcorn';
import { isLayerFulfilled, validateBeforeSave } from '../../lib/utils/project';
import { NONE_CLASS, ANIMATION_TYPES } from '../../lib/constants/animations';
import { DEFAULT_OPTIONS, DEFAULT_OPTIONS_OPTIN } from '../../lib/constants/settings/retarget-settings';
import { FB_PLUGINS } from '../../lib/constants/settings/social';

import {
  SANTISECOND,
  MAX_ZINDEX,
  DEFAULT_CONTAINER,
  DEFAULT_DURATION,
  DEFAULT_LAYER,
  DEFAULT_ITEM,
  SOCIALS,
  MAX_DURATION,
  ALLOWED_SAVE_AS,
} from '../../lib/constants/project';

import MediaTypeDetector from '../../lib/utils/mediaTypeDetector';
import { getCustomVarsFromMediaArr } from '../../lib/utils/tokens-helper';
import { NUMBER_OF_STEPS } from '../../lib/constants/actions';
import { showConfirmation, showError, showInfo } from '../../lib/services/alertService';
import {
  FORM_ONE_LG,
  WARNING_OPACITY,
  WARNINGS,
} from '../../lib/constants/text-info';
import { radioButton } from '../../lib/constants/windowsLogics';
import { ACTION_MAKE_COPY, ACTION_WATCH_VIDEO, PRODUCE_TABS } from '../../lib/constants/ui';
import { ROUTES } from '../../lib/constants/routing';
import { video360prefix, REGEX_MAP } from '../../lib/constants/settings/video';

const caretNames = Object.values(CARET_NAMES);

export default class ProjectStore extends BaseStore {
  constructor(props, runReaction = true) {
    super(props);
    this.layers = [];
    this.elements = [];
    this.mediaTypeDetector = new MediaTypeDetector();
    this.userStore = props.userStore;
    if (runReaction) {
      reaction(
        () => this.popcorn,
        () => {
          if (!this.popcorn.on) {
            return;
          }
          this.popcorn.on('seeking', () => {
            if (this.isPlayed) {
              this.playPause();
            }
          });
          this.popcorn.on('canplayall', () => {
            this.duration = (this.popcorn.duration() || 30) * SANTISECOND;
            this.isLoaded = true;
          });
          this.popcorn.on('elementUpdated', (data) => {
            const { element, options } = data;
            this.findAndUpdate(element.id, options);
          });
          this.popcorn.on('timeupdate', () => {
            this.time = this.popcorn.currentTime() * SANTISECOND;
          });
          this.popcorn.on('ended', () => {
            if (!this.isLooped) {
              this.time = 0;
              this.updateTime(0);
            }
            this.isLooped = false;
          });
          this.popcorn.on('pause', () => {
            this.isPlayed = false;
          });
          this.popcorn.on('play', () => {
            this.isPlayed = true;
          });
          emitter.on(emitterActions.SELECT, id => {
            if (id) {
              const element = this.getElementById(id);
              if (element) {
                const { popcornOptions } = element;
                const currentTime = this.time / SANTISECOND;
                if (currentTime < popcornOptions.start || currentTime > popcornOptions.end) {
                  this.updateTime(popcornOptions.start * SANTISECOND);
                }

                if (this.activeElementId !== id) {
                  this.editElement(id);
                }
              }
            }
          });
          emitter.on(emitterActions.DELETE, id => {
            this.removeElement(id);
          });
          emitter.on(emitterActions.SEQUENCES_LOADING, () => {
            this.isLoadingSequencer = true;
          });
          emitter.on(emitterActions.SEQUENCES_READY, () => {
            this.isLoadingSequencer = false;
          });
          emitter.on(emitterActions.VIDEO_READY, ({ id, width, height }) => {
            this.elements = this.elements.map(el => {
              if (el.id === id) {
                return {
                  ...el,
                  dimensions: { width, height },
                };
              }
              return el;
            });
          });
          emitter.on(emitterActions.VIDEO_LOOPED, () => {
            this.isLooped = true;
          });
        },
      );

      reaction(
        () => this.item.allowedSocials
          && this.item.allowedSocials.some(allowedSocial => allowedSocial === SOCIALS.LINKEDIN),
        () => {
          if (!this.userStore.linkedinEnabled) {
            this.item.allowedSocials = this.item.allowedSocials
              .filter(allowedSocial => allowedSocial !== SOCIALS.LINKEDIN);
          }
        },
      );
    }
  }

  setUndo = () => {
    const snapshot = toJS(this.projectData);
    this.redoStore = [];
    this.setUndoRedoAction({
      projectData: snapshot,
      duration: this.duration,
      retarget: { ...this.retarget },
      activeElementId: this.activeElementId,
    });
  };

  @observable userStore = {};

  @observable activeElementId;

  @observable assets = [];

  @observable item = {};

  @observable isLoaded = false;

  @observable isRedirect = false;

  @observable isPlayed = false;

  @observable isLooped = false;

  @observable isLoading = false;

  @observable isLoadingSequencer = false;

  @observable projectData = {};

  @observable undoStore = [];

  @observable redoStore = [];

  @observable layers;

  @observable elements = [];

  @observable videoElements = [];

  @observable audioElements = [];

  @observable popcorn = {};

  @observable modified = false;

  @observable retarget;

  @observable showedRetarget = false;

  @observable prevMultiselectElement;

  @observable isFirstTrackFull;

  @observable pluginDefaults = {
    [POPCORN_ELEMENT_TYPES.TEXT]: {},
    [POPCORN_ELEMENT_TYPES.IMAGE]: {},
  };

  getPersonalization = () => getCustomVarsFromMediaArr(this.projectData.media);

  generateUid = () => `${Date.now()}/${Math.random()}/${Date.now() * Math.random()}`;

  @observable duration = 30 * SANTISECOND;

  @observable time = 0;

  @observable warning = null;

  @observable success = null;

  @action
  setIsRedirect = (value = false) => {
    this.isRedirect = value;
  };

  @action
  undoRedoAction = (undo = true) => {
    const targetData = undo ? this.undoStore : this.redoStore;
    const targetDataLength = targetData.length;
    if (!targetDataLength) {
      return;
    }

    this.modified = true;
    const { projectData, duration, retarget, activeElementId } = targetData[targetDataLength - 1];
    const snapshot = toJS(this.projectData);
    targetData.pop();

    this.setUndoRedoAction({
      projectData: snapshot,
      duration: this.duration,
      retarget: { ...this.retarget },
      activeElementId: this.activeElementId,
    }, !undo);
    if (this.activeElementId !== activeElementId) {
      this.releaseElement();
    }
    this.elements.map(event => this.popcorn.removeTrackEvent(event.id));
    this.setProjectData(projectData);
    this.attach(this.popcorn.target);
    this.retarget = retarget;
    this.editElement(activeElementId);
    if (this.retarget && this.retarget.id === activeElementId) {
      // eslint-disable-next-line no-underscore-dangle
      if (this.retarget._update) {
        // eslint-disable-next-line no-underscore-dangle
        this.retarget._update(this.retarget, this.retarget.options);
      }
      if (this.retarget.showed) {
        this.retarget.start();
      } else {
        this.retarget.end();
      }
    }
    if (this.duration !== duration) {
      this.updateVideoDuration(duration / SANTISECOND);
    }
    if (this.time > this.duration) {
      this.updateTime(0);
    }
  };

  setElementOptions = async (item) => {
    const { track, type } = item || {};
    const options = this.pluginDefaults && this.pluginDefaults[type]
      ? this.pluginDefaults[type].popcornOptions || {} : {};
    options.start = item.start || (Math.ceil(this.time) / SANTISECOND);
    const duration = item.duration || DEFAULT_DURATION;
    options.end = item.end || (options.start + duration);
    options.id = `0.${this.generateUid()}`;
    options.zindex = track && track.order ? MAX_ZINDEX - track.order : MAX_ZINDEX;
    options.opacity = 100;

    switch (type) {
      case SEQUENCER: {
        this.isLoadingSequencer = true;
        if (item.is360 && this.userStore.video360Enabled) {
          if (item.extra && item.extra.source && item.extra.source.length) {
            if (REGEX_MAP.Adaptive.test(item.extra.source[0])) {
              item.extra.source[0] = `${video360prefix}${item.extra.source[0]}`;
            } else {
              this.warning = WARNINGS.wrongFormat360;
            }
          } else if (REGEX_MAP.Adaptive.test(item.url)) {
            item.url = `${video360prefix}${item.url}`;
          } else {
            this.warning = WARNINGS.wrongFormat360;
          }
        }
        const source = (item.extra && item.extra.source) || [item.url];
        const fileDuration = (item.extra && item.extra.duration) || null;
        let { fileMeta } = item;
        if (!fileMeta) {
          try {
            fileMeta = await this.mediaTypeDetector.getMetadata(source[0], null, fileDuration,
              this.userStore.video360Enabled);
          } catch (e) {
            // if there is no error, then loading will hide, after adding the item to the popcorn
            this.isLoadingSequencer = false;
            throw e;
          }
        }
        options.end = options.start + (fileMeta?.duration ?? item.duration);
        options.source = source;
        options.title = fileMeta?.title ?? item.title;
        options.duration = fileMeta?.duration ?? item.duration;
        options.from = 0;
        options.contentType = fileMeta?.contentType ?? item.contentType;
        options.in = options.start;
        options.out = options.end;
        options.volume = item.volume !== undefined ? item.volume : 100;
        options.mute = item.volume === 0;
        options.audioFadeIn = item.audioFadeIn || 0;
        options.audioFadeOut = item.audioFadeOut || 0;
        options.fill = item.fill || false;

        if (item.kind === ASSET_TYPES.PERSONALIZED_VOICE) {
          options.templateId = item._id;
        }

        const maxDuration = MAX_DURATION / SANTISECOND;
        if (options.duration * SANTISECOND > MAX_DURATION) {
          options.start = 0;
          options.end = maxDuration;
          options.in = 0;
          options.out = maxDuration;
          options.duration = maxDuration;
        }
        if (options.end * SANTISECOND > MAX_DURATION) {
          options.start = (MAX_DURATION - options.duration * SANTISECOND) / SANTISECOND;
          options.end = maxDuration;
        }
        if (options.out * SANTISECOND > MAX_DURATION) {
          options.in = (MAX_DURATION - options.duration * SANTISECOND) / SANTISECOND;
          options.out = maxDuration;
        }
        break;
      }
      case POPCORN_ELEMENT_TYPES.IMAGE: {
        options.src = item.src;
        options.fill = false;
        break;
      }
      default:
        break;
    }
    return options;
  };

  @action
  createRetargetForm = (noUndo, kind) => {
    if (!noUndo) {
      this.setUndo();
    }
    const popcornFunctions = window.Popcorn.compositions.retargetForm();
    const manifest = window.Popcorn.manifest.retargetForm;
    let options;
    if (this.retarget && this.retarget.options) {
      options = { ...this.retarget.options, ...DEFAULT_OPTIONS };
    } else {
      options = (kind === POPCORN_ELEMENT_TYPES.RETARGET
        ? { ...DEFAULT_OPTIONS }
        : { ...DEFAULT_OPTIONS_OPTIN });
    }

    const retargetOptions = {
      id: `0.${this.generateUid()}`,
      manifest,
      type: POPCORN_ELEMENT_TYPES.RETARGET,
      options,
      kind,
    };

    // eslint-disable-next-line no-underscore-dangle
    popcornFunctions._setup(retargetOptions);
    this.retarget = { ...retargetOptions, ...popcornFunctions };
    this.retarget.end = () => {
      this.showedRetarget = false;
      if (popcornFunctions.end) {
        popcornFunctions.end(this.retarget);
      }
    };
    this.retarget.start = () => {
      this.showedRetarget = true;
      if (popcornFunctions.start) {
        popcornFunctions.start(retargetOptions);
      }
    };
  };

  @action
  isDefaultRetargetElement = ({ key, currentValue, defaultValue, isAdvancedOptin }) => {
    let result;
    if (!isAdvancedOptin) {
      result = key === ELEMENTS
        ? JSON.stringify(currentValue) === JSON.stringify(DEFAULT_OPTIONS_OPTIN[key])
        : currentValue === DEFAULT_OPTIONS_OPTIN[key];
    } else {
      result = key === ELEMENTS
        ? JSON.stringify(currentValue) === JSON.stringify(defaultValue)
        : currentValue === defaultValue;
    }
    return result;
  }


  @action
  addRetargetForm = ({ kind, showed, noUndo }) => {
    if (this.retarget && this.retarget.options && this.retarget.id) {
      const isAdvancedOptin = kind === POPCORN_ELEMENT_TYPES.ADVANCED_OPTIN;
      Object.keys(DEFAULT_OPTIONS_OPTIN).forEach(key => {
        const defaultValue = this.retarget.manifest.options[key].default
          ?? this.retarget.options[key];
        let currentValue = this.retarget.options[key];
        // eslint-disable-next-line no-prototype-builtins
        if (this.retarget.options.hasOwnProperty(key)) {
          if (this.isDefaultRetargetElement({ key, currentValue, defaultValue, isAdvancedOptin })) {
            currentValue = isAdvancedOptin ? DEFAULT_OPTIONS_OPTIN[key] : defaultValue;
            this.retarget.options[key] = currentValue;
          }
        }
      });
      // eslint-disable-next-line no-underscore-dangle
      this.retarget._update({ ...this.retarget }, { ...this.retarget.options });
      this.releaseElement();
    }
    if (!this.retarget || (this.retarget && !this.retarget.id) || !showed) {
      this.createRetargetForm(noUndo, kind);
    }
    this.retarget.kind = kind;
    this.editElement(this.retarget.id);
    if (showed) {
      this.retarget.start();
    }
    this.retarget.showed = showed;
    if (!noUndo) {
      this.modified = true;
    }
  };

  @action
  addLayer = (options) => {
    this.setUndo();
    this.createNewLayer(options);
  };

  @action
  editElement = (elementId) => {
    if (this.retarget
      && this.retarget.id
      && this.retarget.id !== elementId && this.retarget.end) {
      this.retarget.end();
    }
    this.activeElementId = elementId;
  };

  @action
  releaseElement = () => {
    this.activeElementId = null;
  };

  @action
  updateDefaultsPlugin = (options) => {
    if (!this.element || !ALLOWED_SAVE_AS.some(type => type === this.element.type)) {
      return;
    }
    const { type } = this.element;

    if (this.pluginDefaults[type].id === this.activeElementId) {
      this.pluginDefaults[type].popcornOptions = {
        ...this.pluginDefaults[type].popcornOptions,
        ...options,
        id: null,
        src: null,
        opacity: null,
        blendMode: null,
        track: null,
        zIndex: null,
      };
    }
  }

  @action
  findAndUpdate = (elementId, options = {}) => {
    const newValues = Object.keys(options);
    if (newValues && newValues.length && !newValues.every(key => caretNames.includes(key))) {
      this.setUndo();
    }
    if (this.retarget && elementId === this.retarget.id) {
      this.modified = true;
      if (!options.animation) {
        this.retarget.options = {
          ...this.retarget.options,
          ...options,
        };
      }
      // eslint-disable-next-line no-underscore-dangle
      this.retarget._update(this.retarget, options);
    } else {
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
      this.updateDefaultsPlugin(options);
    }
  };

  @action
  updateElement = (elementId, options) => {
    // we need to update the elements, if the user updates the start,
    // end or animation, this is necessary to rerender the elements
    const { start, end, animation, title, duration, htmlText, loop, type } = options;
    this.elements = this.elements.map(element => {
      if (element.id === elementId) {
        const newOptions = {};
        if (start !== undefined && start !== element.popcornOptions.start) {
          newOptions.start = start;
        }
        if (end !== undefined && end !== element.popcornOptions.end) {
          newOptions.end = end;
        }
        if (duration !== undefined && duration !== element.popcornOptions.duration) {
          newOptions.duration = duration;
        }
        if (loop !== undefined && loop !== element.popcornOptions.loop) {
          newOptions.loop = loop;
        }
        if (animation) {
          newOptions.animation = animation;
        }
        if (title) {
          newOptions.title = title;
        }
        if (htmlText !== undefined) {
          newOptions.htmlText = htmlText;
        }
        if (type !== undefined && type !== element.popcornOptions.type) {
          newOptions.type = type;
          Object.values(SOCIAL_TYPES).forEach(item => {
            if (item === type) {
              newOptions.title = FB_PLUGINS[item].title;
            }
          });
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

    if (options.start !== undefined || options.end !== undefined
      || Object.values(SOCIAL_TYPES).some(t => t === element.popcornOptions.type)) {
      this.popcorn.removeTrackEvent(elementId);
      element.popcornOptions = { ...element.popcornOptions, ...options };
      this.popcorn[element.type](element.popcornOptions);
    }
    const trackEvent = this.popcorn.getTrackEvent(elementId);
    // eslint-disable-next-line no-underscore-dangle
    if (trackEvent && trackEvent._natives._update) {
      // _natives and _update is popcorn functions
      // eslint-disable-next-line no-underscore-dangle
      trackEvent._natives._update(trackEvent, options);
    }
  };

  @action
  updateAnimation = async (type, animationName = NONE_CLASS) => {
    const isRetarget = this.retarget && this.retarget.id
      && this.retarget.id === this.activeElementId;
    const oldAnimation = isRetarget ? this.retarget.options.animation
      : (this.element && this.element.popcornOptions.animation);
    const durationOut = isRetarget
    || (this.element && this.element.type === POPCORN_ELEMENT_TYPES.LEAD_GENERATOR) ? 2 : 1;

    const animation = {
      ...(oldAnimation ? { ...oldAnimation } : {}),
      [type]: {
        type: animationName,
        // The animated class has a default speed of 1s
        duration: animationName === NONE_CLASS ? 0 : durationOut,
      },
    };

    const layerElements = this.elements.filter(el => el.track === this.element.track
      && el.popcornOptions.start >= this.element.popcornOptions.end);

    layerElements.sort((a, b) => a.popcornOptions.start - b.popcornOptions.start);

    const isFreeSpace = !(layerElements.length
      && layerElements[0].popcornOptions.start - durationOut
      < this.element.popcornOptions.end);

    if (type === ANIMATION_TYPES.OUT && animationName !== NONE_CLASS && !isRetarget) {
      const needUpdateDuration = [this.element, ...layerElements].some(el => {
        const animationOut = el.popcornOptions.animation && el.popcornOptions.animation.out
          ? el.popcornOptions.animation.out.duration : 0;
        return (
          (el.popcornOptions.end + durationOut + animationOut) > (this.duration / SANTISECOND)
        );
      });

      if (needUpdateDuration) {
        await this.updateVideoDuration((this.duration / SANTISECOND) + durationOut);
      }

      if (!isFreeSpace) {
        layerElements.map(item => this.updateElementFromTimeline({
          needUpdateStartEnd: true,
          elementId: item.id,
          start: item.popcornOptions.start + durationOut,
          end: item.popcornOptions.end + durationOut,
        }));
      }
    }

    this.findAndUpdate(this.activeElementId, { animation });
  };

  @action
  setPopcorn = (target) => {
    if (!this.popcornObject) {
      return;
    }

    if (!target) {
      target = this.popcorn && this.popcorn.target;
    }

    if (this.popcorn && this.popcorn.target) {
      window.Popcorn.destroy(this.popcorn);
    }
    this.popcorn = window.Popcorn.smart(target,
      this.popcornObject.mediaUrlsString, this.popcornObject.mediaPopcornOptions);
    this.attach(target);
  };

  @action
  updateElementFromTimeline = (options) => {
    this.setUndo();
    this.modified = true;
    const { needUpdateLayer, needUpdateStartEnd, elementId, start, end, layerLevel } = options;
    if (needUpdateLayer) {
      this.setLayer(elementId, layerLevel);
    }
    if (needUpdateStartEnd) {
      this.updateStartEnd(elementId, start, end);
    }
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
          opacity: track.opacity,
        };
        layers.push(layer);
      });
      media.tracks = media.tracks.slice().sort((a, b) => a.order - b.order);
    });
    layers = layers.slice().sort((a, b) => a.order - b.order);
    this.layers = layers;
    this.elements = elements;
    this.projectData = projectData;
    if (this.retarget || this.item.project?.retargetForm) {
      this.retarget = { ...this.retarget, ...this.item.project?.retargetForm };
    }
  };

  @computed
  get popcornObject() {
    return this.generatePopcornObject();
  }

  @action
  moveElements = (oldIndex, newIndex) => {
    this.setUndo();
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
  moveFormFields = (oldIndex, newIndex, type) => {
    this.setUndo();
    let newElementFields;
    if (type === POPCORN_ELEMENT_TYPES.LEAD_GENERATOR) {
      this.projectData.media.forEach((media) => {
        media.tracks.forEach(track => {
          track.trackEvents.forEach(elem => {
            if (elem.type === type) {
              newElementFields = [...elem.popcornOptions.elements];
              newElementFields = arrayMove(newElementFields, oldIndex, newIndex);
            }
          });
        });
      });
    } else {
      newElementFields = [...this.retarget.options.elements];
      newElementFields = arrayMove(newElementFields, oldIndex, newIndex);
    }
    this.findAndUpdate(this.activeElementId, { elements: newElementFields });
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
  stopIfPlay = () => {
    if (this.isPlayed) {
      this.popcorn.pause();
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
  preRemix = async (projectId, openModal) => {
    const path = `/api/makes/${projectId}/pre-remix`;
    try {
      const result = await this.request(
        path, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });

      const { scenario } = result;

      switch (scenario) {
        case preRemixVoice.withoutPersonalizeAssets.name:
          return this.remixOne(projectId);
        case preRemixVoice.isOwner.name:
          return this.remixPersonalizedOne(projectId);
        default: {
          openModal(PRE_REMIX_VOICE_MODAL, { scenario });
          return this.remixOne();
        }
      }
    } catch (e) {
      return this.remixOne();
    }
  };

  @action
  fillMakeData = (result, isRemix = false) => {
    this.item.title = `Remix of ${result.title}`;
    this.item.thumbnail = result.thumbnail;
    this.item.description = result.description;
    this.item.remixedFrom = result.project._id;
    this.remixedFromUrl = `${window.location.protocol}//${this.common.self}/edit?project=${result._id}`;
    this.setProjectData(JSON.parse(result.project.data));
    if (isRemix) {
      this.setPopcorn();
      this.attach();
    }
    if (result.project && result.project.retargetForm) {
      this.retarget = this.item.project.retargetForm || result.project.retargetForm;
    }
    if (result.project && result.project.allowedSocials) {
      this.item.allowedSocials = result.project.allowedSocials;
    }
  };

  @action
  remixPersonalizedOne = async (projectId) => {
    this.modified = true;
    this.item = DEFAULT_ITEM;
    if (!projectId) {
      this.setProjectData(this.item.project.data);
      return this.item;
    }
    const path = `/api/makes/${projectId}/remix-personalized`;
    try {
      const result = await this.request(
        path, {
          method: 'POST',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
      this.fillMakeData(result, true);
    } catch (e) {
      this.item = DEFAULT_ITEM;
      this.setProjectData(this.item.project.data);
      throw e;
    }
    return this.item;
  };

  @action
  remixOne = async (projectId, isRemix) => {
    this.modified = true;
    this.item = DEFAULT_ITEM;
    if (!projectId) {
      this.setProjectData(this.item.project.data);
      return this.item;
    }
    const path = `/api/makes/${projectId}/remix`;
    try {
      const result = await this.request(
        path, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
      this.fillMakeData(result, isRemix);
    } catch (e) {
      this.item = DEFAULT_ITEM;
      this.setProjectData(this.item.project.data);
      throw e;
    }
    return this.item;
  };

  @action
  removeElement = (id) => {
    this.setUndo();
    this.modified = true;
    this.releaseElement();
    if (this.projectData.media) {
      this.removeTrackEvent(id);
      this.elements = this.elements.filter(element => element.id !== id);
    }
  };

  @observable
  @action
  addElement = (item) => {
    this.setUndo();
    return this.createNewElement(item);
  };

  removeTrackEvent = (id) => {
    this.projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents = track.trackEvents.filter(trackEvent => trackEvent.id !== id);
        this.popcorn.removeTrackEvent(id);
      });
    });
  };

  @action
  removeLayer = (id) => {
    if (this.layers.length <= 1) {
      return;
    }
    this.setUndo();
    this.modified = true;
    this.projectData.media.forEach((media) => {
      const removedTrack = media.tracks.find(track => track.id === id);
      if (removedTrack && removedTrack.trackEvents.length) {
        removedTrack.trackEvents.forEach((trackEvent) => {
          this.popcorn.removeTrackEvent(trackEvent.id);
          if (trackEvent.id === this.activeElementId) {
            this.releaseElement();
          }
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
    this.setUndo();
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
    const element = this.getElementById(elementId);
    let newElement;
    this.modified = true;
    const layer = this.layers.find(item => item.order === newLayerLevel);
    this.elements = this.elements.map(item => {
      if (item.id === elementId) {
        item.track = layer.id;
        item.popcornOptions.blendMode = layer.blendMode;
        item.popcornOptions.opacity = layer.opacity;
        newElement = item;
        if (layer.blendMode) {
          newElement.popcornOptions.blendMode = layer.blendMode;
        } else {
          newElement.popcornOptions.blendMode = blendModeConstants.normal.value;
        }
        if (layer.opacity) {
          newElement.popcornOptions.opacity = layer.opacity;
        }
      }
      return item;
    });

    this.projectData.media.forEach((media) => {
      media.tracks = media.tracks.map(track => {
        if (track.order === newLayerLevel) {
          const zindex = MAX_ZINDEX - track.order;
          const { blendMode, opacity } = newElement.popcornOptions;
          element.track = track.id;
          element.popcornOptions.zindex = zindex;
          if (layer.blendMode) {
            element.popcornOptions.blendMode = layer.blendMode;
          } else {
            element.popcornOptions.blendMode = blendModeConstants.normal.value;
          }
          if (layer.opacity) {
            element.popcornOptions.opacity = layer.opacity;
          }
          track.trackEvents.push(element);
          this.updatePopcorn(element.id, { zindex, blendMode, opacity });
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
  updateVideoDuration = (value) => {
    this.recompressProject(value, false);
    this.setPopcorn(this.popcorn.target);
    this.duration = Math.ceil(value * SANTISECOND);
  };

  @action
  addData = (makeTemplate = {}, useTime) => {
    let newData = makeTemplate.project.data;
    if (!newData) {
      return;
    }
    this.setUndo();
    newData = JSON.parse(newData);
    if (useTime) {
      return this.addRelativeElements(newData);
    }

    newData.media.map((media) => media.tracks
      .map((track) => {
        if ((track.blendMode && track.blendMode !== blendModeConstants.normal.value)
          || (track.opacity && track.opacity !== 100)) {
          this.addLayer({
            blendMode: track.blendMode || blendModeConstants.normal.value,
            opacity: track.opacity || 100,
          });
        }

        return track.trackEvents.map((trackEvent) => {
          const item = {
            ...trackEvent.popcornOptions,
            type: trackEvent.type,
            track: null,
            start: null,
            end: null,
            zindex: null,
            duration: trackEvent.popcornOptions.end - trackEvent.popcornOptions.start,
            kind: makeTemplate.kind || trackEvent.popcornOptions.kind,
          };
          return this.createNewElement(item);
        });
      }));
  };

  addRelativeElements = data => {
    let firstElementStart = null;

    data.media.forEach((media) => media.tracks
      .forEach((track) => track.trackEvents.forEach((trackEvent) => {
        if (!firstElementStart) {
          firstElementStart = trackEvent.popcornOptions.start;
        }

        if (parseFloat(trackEvent.popcornOptions.start) < firstElementStart) {
          firstElementStart = trackEvent.popcornOptions.start;
        }
      })));

    data.media.forEach((media) => media.tracks
      .forEach((track) => {
        if ((track.blendMode && track.blendMode !== blendModeConstants.normal.value)
          || (track.opacity && track.opacity !== 100)) {
          this.addLayer({
            blendMode: track.blendMode || blendModeConstants.normal.value,
            opacity: track.opacity || 100,
          });
        }

        return track.trackEvents.forEach((trackEvent) => {
          const item = {
            ...trackEvent.popcornOptions,
            track: null,
            zindex: null,
            start: null,
            end: null,
          };

          if (trackEvent.popcornOptions.start === firstElementStart) {
            item.start = this.time / SANTISECOND;
          } else if (trackEvent.popcornOptions.start < firstElementStart) {
            item.start = (this.time / SANTISECOND)
              - (firstElementStart - trackEvent.popcornOptions.start);
            if (item.start < 0) {
              item.start = 0;
            }
          } else {
            item.start = (this.time / SANTISECOND)
              + (trackEvent.popcornOptions.start - firstElementStart);
          }

          item.end = (trackEvent.popcornOptions.end - trackEvent.popcornOptions.start) + item.start;

          return this.addElement(item);
        });
      }));
  }

  @action
  updateStartEnd = (elementId, start, end) => {
    start = Math.ceil(start * SANTISECOND) / SANTISECOND;
    end = Math.ceil(end * SANTISECOND) / SANTISECOND;
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
      if (this.item.project && this.item.project.allowedSocials) {
        this.item.allowedSocials = this.item.project.allowedSocials;
      }
    } catch (e) {
      this.item = DEFAULT_ITEM;
      this.setProjectData(this.item.project.data);
      throw e;
    }
    return this.item;
  };

  @action
  setUndoRedoAction = (projectData, undo = true) => {
    const targetData = undo ? this.undoStore : this.redoStore;
    targetData.push(projectData);
    if (targetData.length > NUMBER_OF_STEPS) {
      targetData.shift();
    }
  };

  @computed
  get form() {
    if (!this.activeElementId) {
      return null;
    }
    let element;
    const resultOptions = {};
    if (this.retarget && this.activeElementId === this.retarget.id) {
      element = this.retarget.manifest;
      const { options } = element;
      Object.keys(options).forEach((fieldName) => {
        if (!options[fieldName].hidden) {
          resultOptions[fieldName] = options[fieldName];
        }
      });
    } else {
      element = this.popcorn.getTrackEvent(this.activeElementId);
      // eslint-disable-next-line no-underscore-dangle
      const { options } = element._natives.manifest;
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
    this.popcornObject.popcornElements.forEach((element) => this.popcorn[element.type](target
      ? { ...element.popcornOptions, target }
      : element.popcornOptions));
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
    disabledPlaybar: this.item.disabledPlaybar,
  });

  @action
  recompressProject = (newDuration, updateElements = true) => {
    this.projectData.media.forEach((media) => {
      const initialDuration = media.duration;
      if (initialDuration >= newDuration) {
        return;
      }
      media.duration = newDuration;
      media.url = `#t=,${newDuration}`;
      if (updateElements) {
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
      }
    });
  };

  @action
  addElementToProject = (trackEvent) => {
    const { id, popcornOptions, type } = trackEvent;
    if (!popcornOptions.target) {
      popcornOptions.target = DEFAULT_CONTAINER;
    }
    this.popcorn[type]({ id, ...popcornOptions });
    this.projectData.media.forEach((media) => {
      media.tracks.forEach(track => {
        if (track.id === trackEvent.track) {
          track.trackEvents.push(trackEvent);
        }
      });
    });
  };

  @action
  save = async () => {
    if (!this.modified) {
      return;
    }
    this.undoStore = [];
    this.redoStore = [];
    this.isLoading = true;

    const { byEnd } = this.popcorn && this.popcorn.data.trackEvents;

    // crop video
    if (byEnd && byEnd.length && byEnd.length > 1) {
      const lastEvent = byEnd[byEnd.length - 2];
      let eventEnd = 0;

      switch (lastEvent.type) {
        case POPCORN_ELEMENT_TYPES.TEXT:
        case POPCORN_ELEMENT_TYPES.IMAGE:
          if (lastEvent.animation && lastEvent.animation.out && lastEvent.animation.out.duration) {
            eventEnd = lastEvent.end + lastEvent.animation.out.duration;
          } else {
            eventEnd = lastEvent.end;
          }
          break;
        case POPCORN_ELEMENT_TYPES.JSON_ANIMATION:
          if (lastEvent.outDuration) {
            eventEnd = lastEvent.end + lastEvent.outDuration;
          } else {
            eventEnd = lastEvent.end;
          }
          break;
        default:
          eventEnd = lastEvent.end;
      }

      if (lastEvent.end !== this.popcorn.duration() && byEnd.length !== 2) {
        this.projectData.media[0].url = `#t=,${eventEnd}`;
        this.projectData.media[0].duration = eventEnd;
        this.duration = eventEnd * SANTISECOND;
        this.setPopcorn();
      }

      if (byEnd.length === 2) {
        this.projectData.media[0].url = `#t=,${30}`;
        this.projectData.media[0].duration = 30;
        this.duration = 30 * SANTISECOND;
        this.setPopcorn();
      }
    }

    try {
      const path = this.item._id
        ? `/api/users/me/makes/${this.item._id}`
        : '/api/users/me/makes';
      let serializedData = this.serializeProject();
      if (this.retarget && this.retarget.id) {
        const retargetForm = {
          showed: this.retarget.showed,
          options: { ...this.retarget.options },
          kind: this.retarget.kind,
        };
        serializedData = { retargetForm, ...serializedData };
      }
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
            disabledPlaybar: serializedData.disabledPlaybar,
          },
        });
      const publishedMake = await this.publish(result._id);
      runInAction(() => {
        this.item = { ...this.item, ...result };
        if (this.item.project.allowedSocials) {
          this.item.allowedSocials = this.item.project.allowedSocials;
        }
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
  checkAndSave = async ({
    changeRadioButton,
    showProducePanel,
    closeAllWindows,
    setInitialView,
    actionType,
    afterSave,
  }) => {
    try {
      const errors = validateBeforeSave(this.item);
      if (errors) {
        switch (true) {
          case errors.title: {
            changeRadioButton(radioButton.BOTTOM);
            return showProducePanel({ tab: PRODUCE_TABS.SETTINGS });
          }
          default: {
            return showError('The project is not valid.');
          }
        }
      } else if (await showConfirmation('Project will be saved')) {
        closeAllWindows();
        const project = await this.save();
        if (!this.modified) {
          if (actionType === ACTION_MAKE_COPY) {
            afterSave(`/edit?remix=${this.item._id}`);
          }
          if (actionType === ACTION_WATCH_VIDEO) {
            afterSave(this.item.url);
          }
        }
        if (project && project._id) {
          Router.push(
            {
              pathname: ROUTES.edit,
              query: {
                project: project._id,
              },
            },
            undefined,
            {
              shallow: true,
            },
          );
          setInitialView();
        }
      }
    } catch (e) {
      showError(e.message);
    }
  }

  @action
  invalidateFbCache = (url) => this.request(
    '/api/makes/update-fb-cache', {
      method: 'POST',
      headers: {
        'on-behalf': this.currentUser.id,
      },
      body: { publishUrl: url },
    });

  publish = (id) => this.request(
    `/api/users/me/makes/${id}/publish`, {
      method: 'POST',
      headers: {
        'on-behalf': this.currentUser.id,
      },
    });

  fromTemplate = async (makeTemplate = {}, video = null, isSource) => {
    this.item.allowedSocials = ['facebook'];
    this.item.title = makeTemplate.title;
    this.item.description = makeTemplate.description;
    this.modified = true;
    this.item.thumbnail = makeTemplate.thumbnail;
    if (isSource) {
      this.item.source = makeTemplate._id;
    }
    this.setProjectData(JSON.parse(makeTemplate.project.data));
    this.setPopcorn();
    if (video) {
      await this.updateVideo(video);
    }
    this.setProjectData(this.projectData);
    this.setPopcorn();
  };

  @action
  updateVideo = async (value, trimming) => {
    const videoMeta = await this.mediaTypeDetector.getMetadata(value);
    let sequencerElement = null;
    this.projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents.forEach((trackEvent) => {
          if (trackEvent.type === 'sequencer'
            && trackEvent.popcornOptions.subtype !== 'audio' && !sequencerElement) {
            sequencerElement = trackEvent;
          }
        });
      });
    });
    if (sequencerElement) {
      this.findAndUpdate(sequencerElement, {
        source: [value],
        type: videoMeta.type,
        title: videoMeta.title,
        from: trimming ? trimming.min : 0,
        end: (trimming ? trimming.max : videoMeta.duration) - (trimming ? trimming.min : 0),
        duration: videoMeta.duration,
      });
    } else {
      this.projectData.media.forEach((media) => {
        if (media.tracks.length > 0) {
          const elementId = `0.${this.generateUid()}`;
          const layerId = this.generateUid();
          media.tracks.push({
            name: `${media.tracks.length}`,
            id: layerId,
            order: media.tracks.length,
            trackEvents: [{
              id: elementId,
              type: 'sequencer',
              popcornOptions: {
                start: 0,
                source: [value],
                fallback: '',
                denied: false,
                from: trimming ? trimming.min : 0,
                end: (trimming ? trimming.max : videoMeta.duration) - (trimming ? trimming.min : 0),
                title: videoMeta.title,
                duration: videoMeta.duration,
                type: videoMeta.type,
                hidden: false,
                target: 'video-container',
                mobile: true,
                width: 100,
                height: 100,
                top: 0,
                left: 0,
                volume: 100,
                mute: false,
                zindex: MAX_ZINDEX - media.tracks.length,
                id: elementId,
              },
              track: layerId,
              name: elementId,
            }],
          });
        }
      });
    }
    this.recompressProject(trimming ? (trimming.max - trimming.min) : videoMeta.duration);
  };

  @computed
  get element() {
    if (!this.activeElementId) {
      return null;
    }
    const currentElement = this.popcornElements
      .find(element => element.id === this.activeElementId);
    if (!currentElement) {
      return null;
    }
    const popcornOptions = this.popcorn.getTrackEvent(this.activeElementId);

    if (popcornOptions) {
      currentElement.popcornOptions = {
        ...currentElement.popcornOptions,
        src: popcornOptions.src,
        duration: popcornOptions.duration,
      };
    }

    return currentElement;
  }

  @action
  setAsDefault = (reset) => {
    if (!this.element || !ALLOWED_SAVE_AS.some(type => type === this.element.type)) {
      return;
    }
    if (reset) {
      this.pluginDefaults[this.element.type] = {};
      return;
    }
    this.pluginDefaults[this.element.type] = {
      id: this.activeElementId,
      popcornOptions: {
        ...this.element.popcornOptions,
        id: null,
        src: null,
        opacity: null,
        blendMode: null,
        track: null,
        zIndex: null,
      },
    };
  };

  getElementById(id) {
    return this.popcornElements.find(element => element.id === id);
  }

  @computed
  get canUndo() {
    return this.undoStore.length;
  }

  @computed
  get canRedo() {
    return this.redoStore.length;
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
      if (isCurrentElement && element.type === POPCORN_ELEMENT_TYPES.TEXT_MASK) {
        this.updatePopcorn(element, { newSize: true });
      }
    });
  };

  @action
  runMapResize = () => {
    this.popcornElements.forEach(element => {
      if (element.type === POPCORN_ELEMENT_TYPES.GOOGLE_MAP
        && (element.popcornOptions.type === GOOGLE_MAP_VALUES.STREETVIEW
          || element.popcornOptions.type === GOOGLE_MAP_VALUES.SIDEBYSIDE)) {
        this.updatePopcorn(element, { runResize: true });
      }
    });
  };

  @computed
  get popcornElements() {
    return this.popcornObject.popcornElements || [];
  }

  @action
  showWarning = (message) => {
    this.warning = message;
  };

  @action
  showSuccess = (message) => {
    this.success = message;
  };

  @action
  setLayerStyle = (layerId, style) => {
    const { name, value } = style;

    this.setUndo();
    this.modified = true;
    const elements = this.popcornElements.filter(element => element.track === layerId);
    elements.forEach(element => {
      this.updatePopcorn(element, { [name]: value });
    });
    this.layers = this.layers.map(layer => {
      if (layer.id === layerId) {
        layer[name] = value;
      }
      return layer;
    });

    let itemOnLayerWithAnimation = false;

    this.projectData.media.forEach((media) => {
      media.tracks = media.tracks.map((track) => {
        if (track.id === layerId) {
          track[name] = value;
        }
        track.trackEvents.forEach(trackEvent => {
          if (trackEvent.track === layerId) {
            if (trackEvent.popcornOptions.animation) {
              itemOnLayerWithAnimation = true;
            }
            trackEvent.popcornOptions[name] = value;
            this.updatePopcorn(trackEvent, { [name]: value });
          }
        });
        return track;
      });
    });

    if (itemOnLayerWithAnimation) {
      this.showWarning(WARNING_OPACITY.title);
    }
  };

  @action
  changeDuration = (newDuration) => {
    const { duration, elements, time } = this;
    let lastEnd = newDuration * SANTISECOND;
    if (lastEnd === duration || lastEnd <= 0 || lastEnd > MAX_DURATION) {
      return;
    }
    this.setUndo();
    this.modified = true;
    if (lastEnd < duration) {
      elements.forEach(({ popcornOptions: { end }, type }) => {
        if (type === SEQUENCER) { // element is image or audio
          if (lastEnd < end * SANTISECOND) {
            lastEnd = end * SANTISECOND;
          }
        }
      });
      elements.forEach(({ popcornOptions: { start, end }, id, type }) => {
        if (type !== SEQUENCER) {
          if (start * SANTISECOND < lastEnd && lastEnd < end * SANTISECOND) {
            this.findAndUpdate(id, { end: lastEnd / SANTISECOND });
          }
          if (lastEnd < start * SANTISECOND) {
            this.removeElement(id);
          }
        }
      });
      this.projectData.media[0].url = `#t=,${lastEnd / SANTISECOND}`;
      this.projectData.media[0].duration = lastEnd / SANTISECOND;
      this.duration = lastEnd;
      this.setPopcorn();
    }
    if (lastEnd > duration) {
      this.projectData.media[0].url = `#t=,${lastEnd / SANTISECOND}`;
      this.projectData.media[0].duration = lastEnd / SANTISECOND;
      this.duration = lastEnd;
      this.setPopcorn();
    }

    if (time >= lastEnd) {
      this.updateTime(0);
    }
  };

  @observable
  findLayerForType = (kind) => {
    // we add images on the new layer
    if (kind === ASSET_TYPES.IMAGE) {
      // to check if the first track is empty
      if (this.layers.length > 1 || this.isFirstTrackFull || this.elements.length) {
        this.createNewLayer();
      }
      const [track] = this.layers;
      this.isFirstTrackFull = true;
      return { track, end: 0 };
    }
    const findElement = this.elements.find(element => element.popcornOptions.kind === kind);
    if (findElement) {
      const currentTrack = (findElement.track && findElement.track.id) || findElement.track;
      const track = this.layers.find(element => element.id === currentTrack);
      let layerElements;
      if (this.elements) {
        layerElements = this.elements.filter((element) => element.track === currentTrack);
      }
      const sortedElements = layerElements
        .sort((a, b) => b.popcornOptions.end - a.popcornOptions.end);
      const lastElement = sortedElements[0];
      return { track, end: lastElement.popcornOptions.end };
    }
    // add video or audio to the new layer if the first is present or full
    if (this.layers.length > 1 || this.isFirstTrackFull || this.elements.length) {
      this.createNewLayer();
    }
    const [track] = this.layers;
    this.isFirstTrackFull = true;
    return { track, end: 0 };
  };

  // untraceable methods for undo redo
  // analog for addElement
  @action
  createNewElement = async (item) => {
    const { type } = item;
    this.modified = true;
    if (this.isPlayed) {
      this.playPause();
    }
    if (type === POPCORN_ELEMENT_TYPES.LEAD_GENERATOR
      && this.elements.some(el => el.type === type)) {
      this.releaseElement();
      return showInfo(FORM_ONE_LG.text, FORM_ONE_LG.title);
    }

    const options = await this.setElementOptions(item);

    // get first track
    let track = item.track || this.layers[0];

    const layerElements = this.elements.filter(element => element.track === track.id);
    if (isLayerFulfilled(options, layerElements)) {
      this.createNewLayer();
      [track] = this.layers;
    }

    if (track.blendMode || item.blendMode) {
      options.blendMode = track.blendMode || item.blendMode;
    } else {
      options.blendMode = blendModeConstants.normal.value;
    }

    if (track.opacity) {
      options.opacity = track.opacity;
    }

    const element = {
      id: options.id,
      type,
      track: track.id,
      name: options.id,
      popcornOptions: { ...item, ...options, type: undefined },
    };

    this.addElementToProject(element);

    // update duration
    if (options.end > this.duration / SANTISECOND) {
      this.recompressProject(options.end, false);
      this.setPopcorn(this.popcorn.target);
      this.duration = Math.ceil(options.end * SANTISECOND);
    }

    // update timeline
    this.elements = [element, ...this.elements];

    this.editElement(element.id);
  };

  @observable
  @action
  createNewElements = async (elements, end) => {
    this.stopIfPlay();
    this.setUndo();
    await this.updateEnd(end);
    this.isFirstTrackFull = false;
    return Bb.all(elements.map(item => this.createNewElement(item)));
  }

  updateEnd = (end) => {
    if (end > this.duration / SANTISECOND) {
      this.recompressProject(end, false);
      this.setPopcorn(this.popcorn.target);
      this.duration = Math.ceil(end * SANTISECOND);
    }
  };

  // analog for addLayer
  @action
  createNewLayer = (options) => {
    const blendMode = options && options.blendMode
      ? options.blendMode : blendModeConstants.normal.value;
    const opacity = options && options.opacity ? options.opacity : 100;

    this.modified = true;

    const newId = this.generateUid();

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
      media.tracks.unshift({ ...DEFAULT_LAYER, id: newId, blendMode, opacity });
    });

    this.layers = this.layers.map(track => {
      track.order += 1;
      track.defaultName = `Layer ${track.order}`;
      return track;
    });

    this.layers.unshift({
      ...DEFAULT_LAYER,
      id: newId,
      defaultName: 'Layer 0',
      blendMode,
      opacity,
    });
  };

  @action
  togglePersonalizer = (showed) => {
    this.modified = true;
    this.setUndo();
    this.retarget.showed = showed;

    this.toggleViewPersonalizer(showed);
  };

  @action
  toggleViewPersonalizer = (showed) => {
    if (showed) {
      this.retarget.start();
    } else {
      this.retarget.end();
    }
  }

  @action
  updateLayerElements = async (newEnd, element) => {
    if (newEnd < element.popcornOptions.end) {
      return null;
    }
    const elementAnimationOut = element.popcornOptions.animation?.out?.duration || 0;
    const differenceLength = +((newEnd - element.popcornOptions.end).toFixed(2));
    const elementsForUpdate = [];
    const elementsEnds = [];
    let animationOut = 0;
    let itemStartAfterToVideo = null;
    let animationOutInLastItem = 0;

    this.projectData.media.forEach(media => {
      media.tracks.forEach(track => {
        track.trackEvents.forEach(trackEvent => {
          if (trackEvent.track === element.track) {
            if (trackEvent.popcornOptions.end > Math.max(...elementsEnds)) {
              animationOutInLastItem = trackEvent.popcornOptions.animation?.out?.duration || 0;
            }
            elementsEnds.push(trackEvent.popcornOptions.end);
            if (element.popcornOptions.end <= trackEvent.popcornOptions.start) {
              elementsForUpdate.push(trackEvent);
              if (trackEvent.popcornOptions.animation
                && trackEvent.popcornOptions.animation.out) {
                // eslint-disable-next-line max-len
                animationOut += trackEvent.popcornOptions.animation.out.duration;
              }
            }
          }
        });
      });
    });

    if (elementsForUpdate && elementsForUpdate.length) {
      elementsForUpdate.forEach(item => {
        if (item.popcornOptions.start
          <= itemStartAfterToVideo || !itemStartAfterToVideo) {
          itemStartAfterToVideo = item.popcornOptions.start;
        }
      });
    }

    if (newEnd + elementAnimationOut > itemStartAfterToVideo) {
      if (this.duration < (Math.max(...elementsEnds)
        + differenceLength + animationOut) * SANTISECOND) {
        await this.updateVideoDuration(
          Math.max(...elementsEnds) + animationOutInLastItem + differenceLength,
        );
      }

      if (elementsForUpdate && elementsForUpdate.length) {
        elementsForUpdate.forEach(item => (
          this.updateElementFromTimeline({
            needUpdateStartEnd: true,
            elementId: item.id,
            start: item.popcornOptions.start + differenceLength,
            end: item.popcornOptions.end + differenceLength,
          })));
      }
    }

    return elementsForUpdate;
  };
}
