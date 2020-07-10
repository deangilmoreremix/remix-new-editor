
/* eslint-disable no-underscore-dangle,no-new-func */
// PLUGIN: jsonTransition

import { extendObservable } from 'mobx';
import isEqual from 'lodash/isEqual';
import {
  timeInRange,
  initializeLottie,
  setIdleState,
  setJsonContainer,
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
  URL,
  LEFT,
  TOP,
  WIDTH,
  HEIGHT,
  ZINDEX,
  POPCORN_ELEMENT_TYPES,
  BLEND_MODE,
  OPACITY,
  MANIFEST_OPTIONS,
} from '../../../constants/popcorn';

import {
  addDeleteListener,
  emitter,
  emitterActions,
  removeDeleteListener,
  selectItem,
} from '../../../mitt/emitter';

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
        [BLEND_MODE]: MANIFEST_OPTIONS[BLEND_MODE],
        [OPACITY]: MANIFEST_OPTIONS[OPACITY],
        [URL]: MANIFEST_OPTIONS[URL],
        [LEFT]: MANIFEST_OPTIONS[LEFT],
        [TOP]: MANIFEST_OPTIONS[TOP],
        [WIDTH]: MANIFEST_OPTIONS[WIDTH],
        [HEIGHT]: MANIFEST_OPTIONS[HEIGHT],
        [ZINDEX]: MANIFEST_OPTIONS[ZINDEX],
      },
    },

    async _setup(options) {
      let target = Popcorn.dom.find(options.target);
      if (!target) {
        target = this.media.parentNode;
      }
      options._target = target;

      const context = this;
      options._context = context;

      setJsonContainer(options, Popcorn);

      setContextListeners.call(context, options);

      options._container.addEventListener('click', (event) => {
        event.stopPropagation();
        selectItem(event, options.id);
      });

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

      extendObservable(options, {
        url: options.url,
        start: options.start,
        end: options.end,
        colors: options.colors,
        animation: options.animation,
      });

      if (options.url) {
        await initializeLottie(options);
        gotoIdlePosition(options.animation);
      }

      if (timeInRange.call(this, { ...options, time: this.currentTime() })) {
        setIdleState(options);
      } else {
        off(options._container);
      }
      target.appendChild(options._container);
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

        await initializeLottie(trackEvent);
        gotoIdlePosition(trackEvent.animation);
      }

      if (options.colors !== undefined && !isEqual(options.colors, trackEvent.colors)) {
        trackEvent.colors = options.colors.slice();

        await initializeLottie(trackEvent);
        gotoIdlePosition(trackEvent.animation);
      }

      if (options.start !== undefined && options.start !== trackEvent.start) {
        trackEvent.start = options.start;
      }

      if (options.zindex !== undefined && options.zindex !== trackEvent.zindex) {
        trackEvent.zindex = options.zindex;
        trackEvent._container.style.zIndex = +trackEvent.zindex;
      }

      if (options.blendMode !== undefined && options.blendMode !== trackEvent.blendMode) {
        trackEvent.blendMode = options.blendMode;
        trackEvent._container.style.mixBlendMode = trackEvent.blendMode;
      }

      if (options.opacity !== undefined
        && options.opacity !== trackEvent.opacity && options.opacity !== 100) {
        trackEvent.opacity = options.opacity;
        trackEvent._container.style.opacity = trackEvent.opacity;
      }
    },

    _teardown(options) {
      if (options._target) {
        options._target.removeChild(options._container);
      }
    },
  });
})(window.Popcorn, window.jQuery);
