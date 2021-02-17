
/* eslint-disable no-underscore-dangle,no-new-func */
// PLUGIN: jsonTransition

import { extendObservable } from 'mobx';
import isEqual from 'lodash/isEqual';
import {
  timeInRange,
  initializeLottie,
  setIdleState,
  setJsonContainer,
  addMouseDownEvent,
  getDefaultOptionValue,
  setAnimationColors,
} from '../../../utils/popcorn-helper';

import {
  addClass,
  removeClass,
  on,
  off,
} from '../../helpers';
import {
  OFF,
  ON,
  POPCORN_ELEMENT_TYPES,
  MANIFEST_OPTIONS,
  DROP_BUTTON,
  START,
  TOP,
  LEFT,
} from '../../../constants/popcorn';
import { TIME } from '../../../constants/forms';

import {
  addDeleteListener,
  emitter,
  emitterActions,
  removeDeleteListener,
} from '../../../mitt/emitter';

import mediaConstants from '../../../constants/media';

((Popcorn) => {
  function gotoIdlePosition(animation) {
    if (animation) {
      animation.goToAndStop(animation.currentFrame, true);
    }
  }

  function setContextListeners(options) {
    this.on('pause', () => {
      const { animation, _container } = options;
      if (animation && !timeInRange.call(this, { ...options, time: this.currentTime() })) {
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
      if (animation && !timeInRange.call(this, { ...options, time: this.currentTime() })) {
        removeClass(_container, ON);
        addClass(_container, OFF);
      } else {
        removeClass(_container, OFF);
        addClass(_container, ON);
      }

      if (animation) {
        animation.goToAndPlay(animation.currentFrame, true);
      }
    });

    this.on('seeking', () => {
      const { animation, _container } = options;
      if (timeInRange.call(this, { ...options, time: this.currentTime() })) {
        addClass(_container, ON);
        removeClass(_container, OFF);
        if (animation) {
          if (animation.pause) {
            animation.pause();
          }

          if (animation) {
            animation.goToAndStop(animation.totalFrames / 2, true);
          }
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
    });
  }

  Popcorn.plugin(POPCORN_ELEMENT_TYPES.JSON_TRANSITION, {
    manifest: {
      about: {
        name: 'Popcorn JSON Transition Plugin',
        version: '0.1',
      },
      options: {
        [DROP_BUTTON]: {
          type: DROP_BUTTON,
          accept: [mediaConstants.JSON_CONTENT_TYPE],
          mediaType: mediaConstants.JSON_CONTENT_TYPE,
          multiple: false,
          needSaveAsset: false,
        },
        [START]: {
          name: START,
          type: TIME,
          label: 'Start',
          className: 'input-time-container',
          default: 0,
        },
        ...MANIFEST_OPTIONS,
      },
    },

    async _setup(options) {
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
      options._context = context;

      setJsonContainer(options, Popcorn);

      setContextListeners.call(context, options);

      addMouseDownEvent(options);

      if (!options.start) {
        options.start = 0.01;
      }

      emitter.on(emitterActions.SELECT, id => {
        const isSelected = id === options.id;
        if (options && options._container) {
          options._container.classList[isSelected ? 'add' : 'remove']('active');
        }
      });

      removeDeleteListener(options._container, options.id);
      addDeleteListener(options._container, options.id);
      target.appendChild(options._container);

      if (options.url) {
        initializeLottie(options, false)
          .then(() => {
            gotoIdlePosition(options.animation);
            if (!options.colors || !options.colors.length) {
              setAnimationColors(options);
              if (options.colors.length) {
                this.emit('elementUpdated', {
                  type: POPCORN_ELEMENT_TYPES.JSON_TRANSITION,
                  element: options,
                  options: {
                    colors: options.colors,
                  },
                  setUndo: false,
                });
              }
            }

            if (timeInRange.call(this, { ...options, time: this.currentTime() })) {
              setIdleState(options);
            } else {
              off(options._container);
            }
          });
      }
    },

    start(event, options) {
      const { animation, _container } = options;
      on(_container);

      if (animation) {
        animation.goToAndPlay(0, true);
      }
    },

    end(event, options) {
      off(options._container);
    },

    async _update(trackEvent, options) {
      if (options.url !== undefined && options.url !== trackEvent.url) {
        trackEvent.url = options.url;

        await initializeLottie(trackEvent, false);
        gotoIdlePosition(trackEvent.animation);
        setAnimationColors(trackEvent);
        if (trackEvent.colors.length) {
          trackEvent._context.emit('elementUpdated', {
            type: POPCORN_ELEMENT_TYPES.JSON_TRANSITION,
            element: trackEvent,
            options: {
              colors: trackEvent.colors,
            },
            setUndo: false,
          });
        }
      }

      if (options.colors !== undefined && !isEqual(options.colors, trackEvent.colors)) {
        trackEvent.colors = options.colors.slice();

        await initializeLottie(trackEvent, false);
        gotoIdlePosition(trackEvent.animation);
      }

      if (options.start !== undefined && options.start !== trackEvent.start) {
        trackEvent.start = options.start;
      }

      if (options.zindex !== undefined && options.zindex !== trackEvent.zindex) {
        trackEvent.zindex = options.zindex;
        trackEvent._container.style.zIndex = +trackEvent.zindex;
      }
    },

    _teardown(options) {
      if (options._target) {
        options._target.removeChild(options._container);
      }
    },
  });
})(window.Popcorn, window.jQuery);
