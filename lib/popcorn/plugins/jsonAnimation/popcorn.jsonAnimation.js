// TODO: Refactor this to fit our needs!
/* eslint-disable no-underscore-dangle,no-new-func */
// PLUGIN: jsomAnimation

import { extendObservable } from 'mobx';
import lottie from 'lottie-web';
import isEqual from 'lodash/isEqual';
import blendModeConstants from '../../../constants/blendMode';

import { loadUrl } from '../../../requestCreator';
import {
  addClass,
  isValidJsonUrl,
  removeClass,
  draggableResizable,
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
  OUT_DURATION,
} from '../../../constants/popcorn';
import { COUNT_FRAMES_IN, COUNT_FRAMES_OUT } from '../../../constants/settings/json-animation';
import { setColors } from '../../../lottie/utils';
import { addDeleteListener, removeDeleteListener } from '../../../mitt/emitter';

((Popcorn) => {
  function timeInRange({ start, end }) {
    const time = this.currentTime();
    return time > start && time < end;
  }

  async function initializeLottie(trackEvent) {
    const { url, colors } = trackEvent;
    if (!url || !isValidJsonUrl(url)) return;

    const animData = await loadUrl(url);

    if (colors && colors.length) {
      setColors(animData, colors);
    }

    if (trackEvent.animation && trackEvent.animation.destroy) {
      trackEvent.animation.destroy();
    }

    trackEvent.animation = lottie.loadAnimation({
      name: trackEvent.id,
      container: trackEvent._container,
      animationData: animData,
      loop: false,
      autoplay: false,
    });

    setLottieListeners(trackEvent);
  }

  function setIdleState(options) {
    const { animation } = options;
    const endFrame = animation.totalFrames - (COUNT_FRAMES_OUT);

    if (animation) {
      if (
        !animation.isPaused
        && animation.currentFrame > COUNT_FRAMES_IN
        && animation.currentFrame < endFrame
      ) {
        animation.goToAndStop(endFrame, true);
      }
    }
  }

  function setLottieListeners(options) {
    options.animation.removeEventListener('enterFrame', () => setIdleState(options));
    options.animation.addEventListener('enterFrame', () => setIdleState(options));
  }

  function getDefaultOptionValue(key) {
    const { options } = Popcorn.manifest[POPCORN_ELEMENT_TYPES.JSON_ANIMATION];
    if (options && options[key]) {
      return options[key].default;
    }
    return null;
  }

  function gotoIdlePosition(animation) {
    if (animation) {
      animation.goToAndStop(animation.totalFrames - COUNT_FRAMES_OUT, true);
    }
  }

  function setContainer(options) {
    const container = document.createElement('div');

    container.style.position = 'absolute';
    container.style.left = `${options.left || getDefaultOptionValue(LEFT)}%`;
    container.style.top = `${options.top || getDefaultOptionValue.call(TOP)}%`;
    container.style.width = `${options.width || getDefaultOptionValue.call(WIDTH)}%`;
    container.style.height = `${options.height || getDefaultOptionValue.call(HEIGHT)}%`;
    container.style.zIndex = options.zindex || getDefaultOptionValue.call(ZINDEX);

    container.classList.add('popcorn-json-animation');
    container.setAttribute('id', options.id);
    container.setAttribute('tabIndex', -1);

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
        [URL]: {
          type: 'input',
          label: 'URL',
          group: 'basic',
          default: '',
        },
        [LEFT]: {
          type: 'number',
          label: 'Left',
          default: 25,
          hidden: true,
        },
        [TOP]: {
          type: 'number',
          label: 'Top',
          default: 0,
          hidden: true,
        },
        [WIDTH]: {
          type: 'number',
          label: 'Width',
          default: 50,
          hidden: true,
        },
        [HEIGHT]: {
          type: 'number',
          label: 'Height',
          default: 10,
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

    async _setup(options) {
      let target = Popcorn.dom.find(options.target);
      if (!target) {
        target = this.media.parentNode;
      }
      options._target = target;

      const context = this;
      options._context = context;
      // for new duration
      options.outDuration = options.outDuration
        || options._natives.manifest.options.outDuration.default;

      setContainer(options);

      setContextListeners.call(context, options);

      options._container.addEventListener('click', (event) => {
        event.stopPropagation();
        context.emit('elementSelected', {
          element: options,
        });
      });
      // TODO: move it to setContainer()
      options._container.style.mixBlendMode = options[BLEND_MODE]
        || getDefaultOptionValue(BLEND_MODE);

      removeDeleteListener(options._container, options.id);
      addDeleteListener(options._container, options.id);

      extendObservable(options, {
        url: options.url,
        start: options.start,
        end: options.end,
        colors: options.colors,
        top: +options.top || getDefaultOptionValue(TOP),
        left: +options.left || getDefaultOptionValue(LEFT),
        animation: options.animation,
      });

      if (options.url) {
        await initializeLottie(options);
        gotoIdlePosition(options.animation);
      }

      off(options._container);
      target.appendChild(options._container);
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

      trackEvent._context.on('elementSelected', (event) => {
        const { element } = event;

        if (trackEvent._container) {
          trackEvent._container.classList[element === trackEvent ? 'add' : 'remove']('active');
        }
      });
      trackEvent._container.addEventListener('click', (event) => {
        event.stopPropagation();
        trackEvent._context.emit('elementSelected', {
          element: trackEvent,
        });
      });

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
