
/* eslint-disable no-underscore-dangle,no-new-func */
// PLUGIN: lottie-json

import { extendObservable } from 'mobx';
import lottie from 'lottie-web';
import blendModeConstants from '../../../constants/blendMode';

import { loadUrl } from '../../../requestCreator';
import {
  isValidJsonUrl,
  draggableResizable,
  on,
  off,
} from '../../helpers';
import {
  SRC,
  LEFT,
  TOP,
  WIDTH,
  HEIGHT,
  ZINDEX,
  POPCORN_ELEMENT_TYPES,
  BLEND_MODE,
  LINK_URL,
} from '../../../constants/popcorn';

import { addDeleteListener, emitter, emitterActions, removeDeleteListener, selectItem } from '../../../mitt/emitter';
import { COUNT_FRAMES_IN, COUNT_FRAMES_OUT } from '../../../constants/settings/json-animation';

const urlRegex = new RegExp('^(?!mailto:)(?:(?:http|https|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$');
const BTN_CLASSNAME = 'click-away-button';

((Popcorn) => {
  function timeInRange({ start, end }) {
    const time = this.currentTime();
    return time >= start && time <= end;
  }

  async function initializeLottie(trackEvent) {
    const { src } = trackEvent;
    if (!src || !isValidJsonUrl(src)) return;

    const animData = await loadUrl(src);

    if (trackEvent.animation && trackEvent.animation.destroy) {
      trackEvent.animation.destroy();
    }

    trackEvent.animation = lottie.loadAnimation({
      name: trackEvent.id,
      container: trackEvent._container,
      animationData: animData,
      loop: true,
      autoplay: true,
    });
  }

  function setIdleState(options) {
    const { animation } = options;
    if (animation) {
      const endFrame = animation.totalFrames - (COUNT_FRAMES_OUT);
      if (
        (!animation.isPaused || animation.currentFrame !== endFrame)
        && animation.currentFrame > COUNT_FRAMES_IN
        && animation.currentFrame < endFrame
      ) {
        animation.goToAndStop(endFrame, true);
      }
    }
  }

  function getDefaultOptionValue(key) {
    const { options } = Popcorn.manifest[POPCORN_ELEMENT_TYPES.JSON_BUTTON];
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
    container.style.top = `${options.top || getDefaultOptionValue(TOP)}%`;
    container.style.width = `${options.width || getDefaultOptionValue(WIDTH)}%`;
    container.style.height = `${options.height || getDefaultOptionValue(HEIGHT)}%`;
    container.style.zIndex = options.zindex || getDefaultOptionValue(ZINDEX);

    container.classList.add('popcorn-json-button');
    container.setAttribute('id', options.id);
    container.setAttribute('tabIndex', -1);

    options._container = container;
    options._container.style.mixBlendMode = options[BLEND_MODE]
      || getDefaultOptionValue(BLEND_MODE);
  }

  function setContextListeners(options) {
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

  function openUrl(url) {
    window.open(
      url,
      '_blank',
    );
  }

  function validateUrl(url) {
    return urlRegex.test(url);
  }

  function setClickAwayButton(options) {
    const nestedButtons = options._container.getElementsByClassName(BTN_CLASSNAME);
    if (validateUrl(options[LINK_URL])) {
      const button = document.createElement('button');
      button.classList.add(BTN_CLASSNAME);
      button.setAttribute('title', 'Click to test the link');
      button.onclick = () => openUrl(options[LINK_URL]);

      if (nestedButtons.length) {
        options._container.replaceChild(button, nestedButtons[0]);
      } else {
        options._container.appendChild(button);
      }
    } else if (nestedButtons.length) {
      options._container.removeChild(nestedButtons[0]);
    }
  }

  Popcorn.plugin(POPCORN_ELEMENT_TYPES.JSON_BUTTON, {
    manifest: {
      about: {
        name: 'JSON Button Plugin',
        version: '0.1',
      },
      options: {
        [BLEND_MODE]: {
          default: blendModeConstants.normal.value,
          hidden: true,
        },
        [SRC]: {
          type: 'input',
          label: 'SRC',
          default: '',
        },
        [LINK_URL]: {
          type: 'input',
          label: 'Link URL',
          default: '',
        },
        [LEFT]: {
          type: 'number',
          label: 'Left',
          default: 0,
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
          default: 30,
          hidden: true,
        },
        [HEIGHT]: {
          type: 'number',
          label: 'Height',
          default: 30,
          hidden: true,
        },
        [ZINDEX]: {
          default: 1000,
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

      setContainer(options);

      setContextListeners.call(context, options);

      options._container.addEventListener('click', (event) => {
        event.stopPropagation();
        selectItem(event, options.id);
      });

      emitter.on(emitterActions.SELECT, id => {
        const isSelected = id === options.id;
        if (options && options._container) {
          options._container.classList[isSelected ? 'add' : 'remove']('active');
        }

        if (isSelected) {
          draggableResizable(options, null, { ratio: 'preserve' });
        }
      });

      removeDeleteListener(options._container, options.id);
      addDeleteListener(options._container, options.id);

      extendObservable(options, {
        src: options.src,
        start: options.start,
        end: options.end,
        top: +options.top || getDefaultOptionValue(TOP),
        left: +options.left || getDefaultOptionValue(LEFT),
        animation: options.animation,
      });

      if (options.src) {
        await initializeLottie(options);
      }

      if (options[LINK_URL]) {
        setClickAwayButton(options);
        // options._container.addEventListener('click', () => openUrl(options[LINK_URL]));
      }

      if (timeInRange.call(this, options)) {
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
        animation.goToAndPlay(0);
      }
    },

    end(event, options) {
      off(options._container);
    },

    async _update(trackEvent, options) {
      if (options.src !== undefined && options.src !== trackEvent.src) {
        trackEvent.src = options.src;

        await initializeLottie(trackEvent);
        gotoIdlePosition(trackEvent.animation);
      }

      if (options.start !== undefined && options.start !== trackEvent.start) {
        trackEvent.start = options.start;
      }

      if (options[LINK_URL] !== undefined && options[LINK_URL] !== trackEvent[LINK_URL]) {
        trackEvent[LINK_URL] = options[LINK_URL];
        setClickAwayButton(trackEvent);
      }

      if (options.end !== undefined && options.end !== trackEvent.end) {
        trackEvent.end = options.end;
      }

      if (options.blendMode !== undefined && options.blendMode !== trackEvent.blendMode) {
        trackEvent.blendMode = options.blendMode;
        trackEvent._container.style.mixBlendMode = trackEvent.blendMode;
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
