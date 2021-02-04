// TODO: Refactor this to fit our needs!
/* eslint-disable no-underscore-dangle,no-new-func */
// PLUGIN: jsomAnimation

import { extendObservable } from 'mobx';
import isEqual from 'lodash/isEqual';
import blendModeConstants from '../../../constants/blendMode';

import {
  addClass,
  removeClass,
  draggableResizable,
  on,
  off,
  removeHandleElements,
} from '../../helpers';
import {
  OFF,
  ON,
  URL,
  DROP_BUTTON,
  LEFT,
  TOP,
  WIDTH,
  HEIGHT,
  ZINDEX,
  POPCORN_ELEMENT_TYPES,
  BLEND_MODE,
  OUT_DURATION,
  OPACITY,
  START,
  END,
} from '../../../constants/popcorn';

import {
  COUNT_FRAMES_OUT,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_TOP,
  DEFAULT_LEFT,
} from '../../../constants/settings/json-animation';

import {
  initializeLottie,
  getDefaultOptionValue,
  setIdleState,
  setAnimationColors,
} from '../../../utils/popcorn-helper';

import {
  addDeleteListener, emitter, emitterActions,
  removeDeleteListener,
  selectItem,
} from '../../../mitt/emitter';

import mediaConstants from '../../../constants/media';
import { TIME } from '../../../constants/forms';

((Popcorn) => {
  function timeInRange({ start, end }) {
    const time = this.currentTime();
    return time >= start && time <= end;
  }

  function gotoIdlePosition(animation) {
    if (animation) {
      animation.goToAndStop(animation.totalFrames - COUNT_FRAMES_OUT, true);
    }
  }

  function setContainer(options) {
    const { manifest } = options._natives;
    const container = document.createElement('div');

    container.style.position = 'absolute';
    container.style.left = `${options.left ?? getDefaultOptionValue(LEFT, manifest)}%`;
    container.style.top = `${options.top ?? getDefaultOptionValue(TOP, manifest)}%`;
    container.style.width = `${options.width || getDefaultOptionValue(WIDTH, manifest)}%`;
    container.style.height = `${options.height || getDefaultOptionValue(HEIGHT, manifest)}%`;
    container.style.zIndex = options.zindex || getDefaultOptionValue(ZINDEX, manifest);

    container.classList.add('popcorn-json-animation');
    container.setAttribute('id', options.id);
    container.setAttribute('tabIndex', -1);
    container.id = options.id;

    options._container = container;
  }

  function setContextListeners(options) {
    this.on('pause', () => {
      const { animation, _container } = options;
      if (animation && !timeInRange.call(this, options)) {
        removeClass(_container, ON);
        addClass(_container, OFF);
      } else {
        gotoIdlePosition(animation);
        removeClass(_container, OFF);
        addClass(_container, ON);
      }
    });

    this.on('play', () => {
      const { animation, _container } = options;
      if (animation && !timeInRange.call(this, options)) {
        removeClass(_container, ON);
        addClass(_container, OFF);
      } else {
        removeClass(_container, OFF);
        addClass(_container, ON);
      }
    });

    this.on('seeking', () => {
      const { animation, _container } = options;

      if (timeInRange.call(this, options)) {
        addClass(_container, ON);
        removeClass(_container, OFF);
        if (animation) {
          if (animation.pause) {
            animation.pause();
          }
          gotoIdlePosition(animation);
        }
      } else {
        addClass(options._container, OFF);
        removeClass(options._container, ON);
      }
    });

    this.on('elementSelected', (event) => {
      const { element } = event;
      if (options._container) {
        options._container.classList[element === options ? 'add' : 'remove']('active');
      }
      if (element.id === options.id) {
        draggableResizable(options, null, { ratio: 'preserve' });
      }
    });
  }

  Popcorn.plugin(POPCORN_ELEMENT_TYPES.JSON_ANIMATION, {
    manifest: {
      about: {
        name: 'Popcorn JSON Animation Plugin',
        version: '0.1',
        author: 'dbaranoff',
      },
      options: {
        [BLEND_MODE]: {
          default: blendModeConstants.normal.value,
          hidden: true,
        },
        [OPACITY]: {
          default: 100,
          hidden: true,
        },
        [START]: {
          name: START,
          type: TIME,
          label: 'Start',
          group: 'basic',
          default: 0,
          className: 'input-time-start input-time-start-lt lt-input-time',
        },
        [END]: {
          name: END,
          type: TIME,
          label: 'End',
          className: 'input-time-start lt-input-time-end',
          default: 0,
        },
        [DROP_BUTTON]: {
          type: DROP_BUTTON,
          accept: [mediaConstants.JSON_CONTENT_TYPE],
          mediaType: mediaConstants.JSON_CONTENT_TYPE,
          multiple: false,
          needSaveAsset: false,
        },
        [URL]: {
          type: 'input',
          label: 'URL',
          group: 'basic',
          default: '',
        },
        [LEFT]: {
          type: 'number',
          label: 'Left',
          default: DEFAULT_LEFT,
          hidden: true,
        },
        [TOP]: {
          type: 'number',
          label: 'Top',
          default: DEFAULT_TOP,
          hidden: true,
        },
        [WIDTH]: {
          type: 'number',
          label: 'Width',
          default: DEFAULT_WIDTH,
          hidden: true,
        },
        [HEIGHT]: {
          type: 'number',
          label: 'Height',
          default: DEFAULT_HEIGHT,
          hidden: true,
        },
        [ZINDEX]: {
          default: 1000,
          hidden: true,
        },
        [OUT_DURATION]: {
          default: 1.5,
          hidden: true,
        },
      },
    },

    _setup(options) {
      extendObservable(options, {
        url: options.url,
        start: options.start,
        end: options.end,
        colors: options.colors,
        top: +options.top || getDefaultOptionValue(TOP, options._natives.manifest),
        left: +options.left || getDefaultOptionValue(LEFT, options._natives.manifest),
        animation: options.animation,
      });
      let target = Popcorn.dom.find(options.target);
      if (!target) {
        target = this.media.parentNode;
      }
      options._target = target;

      const context = this;
      const { isSuperAdmin } = options;

      options.isSuperAdmin = null;
      options._context = context;
      // for new duration
      options.outDuration = options.outDuration
        || options._natives.manifest.options.outDuration.default;

      setContainer(options);

      setContextListeners.call(context, options);

      if (!options.start) {
        options.start = 0.01;
      }

      if (!options.combined) {
        removeDeleteListener(options._container, options.id);
        addDeleteListener(options._container, options.id);

        options._container.addEventListener('mousedown', (event) => {
          event.stopPropagation();
          if (event.ctrlKey && isSuperAdmin) {
            if (options._container.classList.contains('canvas-multiselected-item')) {
              options._container.style.pointerEvents = 'auto';
              options._container.classList.remove('canvas-multiselected-item');
            } else {
              options._container.style.pointerEvents = 'none';
              options._container.classList.add('canvas-multiselected-item');
            }
          }
          selectItem(event, options.id, isSuperAdmin);
        });

        emitter.on(emitterActions.SELECT, data => {
          let id = data;
          if (typeof data === 'object') {
            id = data.id;
          }
          const isSelected = id === options.id;
          if (options && options._container) {
            options._container.classList[isSelected ? 'add' : 'remove']('active');
          }

          if (isSelected) {
            draggableResizable(options, null, { ratio: 'preserve' });
          } else {
            removeHandleElements(options._container);
          }
        });
      }

      // TODO: move it to setContainer()
      options._container.style.mixBlendMode = options[BLEND_MODE]
        || getDefaultOptionValue(BLEND_MODE, options._natives.manifest);
      options._container.style.opacity = options[OPACITY] !== undefined
        ? `${options[OPACITY]}%` : `${getDefaultOptionValue(OPACITY, options._natives.manifest)}%`;

      removeDeleteListener(options._container, options.id);
      addDeleteListener(options._container, options.id);
      target.appendChild(options._container);

      if (options.url) {
        initializeLottie(options)
          .then(() => {
            gotoIdlePosition(options.animation);
            if (!options.colors || !options.colors.length) {
              setAnimationColors(options);
              if (options.colors.length) {
                this.emit('elementUpdated', {
                  type: POPCORN_ELEMENT_TYPES.JSON_ANIMATION,
                  element: options,
                  options: {
                    colors: options.colors,
                  },
                  setUndo: false,
                });
              }
            }
            if (timeInRange.call(this, options)) {
              setIdleState(options);
            } else {
              options._container.classList.remove('on');
              options._container.classList.add('off');
            }
          });
      }
    },

    start(event, options) {
      const { animation, _container } = options;
      on(_container);

      if (animation) {
        animation.goToAndPlay(0);
      }
    },

    end(event, options) {
      const { animation, _container } = options;

      animation.addEventListener('complete', () => off(_container));

      const endFrame = animation.totalFrames - (COUNT_FRAMES_OUT);
      animation.goToAndPlay(endFrame, true);
    },

    async _update(trackEvent, options) {
      if (options.url !== undefined && options.url !== trackEvent.url) {
        trackEvent.url = options.url;

        await initializeLottie(trackEvent);
        gotoIdlePosition(trackEvent.animation);
        setAnimationColors(trackEvent);
        if (trackEvent.colors.length) {
          trackEvent._context.emit('elementUpdated', {
            type: POPCORN_ELEMENT_TYPES.JSON_ANIMATION,
            element: trackEvent,
            options: {
              color: trackEvent.colors,
            },
            setUndo: false,
          });
        }
      }

      if (options.colors !== undefined && !isEqual(options.colors, trackEvent.colors)) {
        trackEvent.colors = options.colors.slice();

        await initializeLottie(trackEvent);
        gotoIdlePosition(trackEvent.animation);
      }

      if (options.start !== undefined && options.start !== trackEvent.start) {
        trackEvent.start = options.start;
      }

      if (options.end !== undefined && options.end !== trackEvent.end) {
        trackEvent.end = options.end;
      }

      if (options.width !== undefined && options.width !== trackEvent.width) {
        trackEvent.width = options.width;
      }

      if (options.top !== undefined && options.top !== trackEvent.top) {
        trackEvent.top = options.top;
      }

      if (options.left !== undefined && options.left !== trackEvent.left) {
        trackEvent.left = options.left;
      }

      if (options.padding !== undefined && options.padding !== trackEvent.padding) {
        trackEvent.padding = options.padding;
      }
      if (options.zindex !== undefined && options.zindex !== trackEvent.zindex) {
        trackEvent.zindex = options.zindex;
        trackEvent._container.style.zIndex = +trackEvent.zindex;
      }

      if (options.blendMode !== undefined && options.blendMode !== trackEvent.blendMode) {
        trackEvent.blendMode = options.blendMode;
        trackEvent._container.style.mixBlendMode = trackEvent.blendMode;
      }

      if (options.opacity !== undefined && options.opacity !== trackEvent.opacity) {
        trackEvent.opacity = options.opacity;
        trackEvent._container.style.opacity = `${trackEvent.opacity}%`;
      }

      trackEvent._container.style.left = `${trackEvent.left}%`;
      trackEvent._container.style.width = `${trackEvent.width}%`;
      trackEvent._container.style.top = `${trackEvent.top}%`;
      trackEvent._container.style.zIndex = +trackEvent.zindex;
    },

    _teardown(options) {
      if (options._target) {
        options._target.removeChild(options._container);
      }
    },
  });
})(window.Popcorn, window.jQuery);
