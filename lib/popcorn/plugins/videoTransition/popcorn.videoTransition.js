/* eslint-disable no-underscore-dangle,no-new-func */
// PLUGIN: videoTransition

import { extendObservable } from 'mobx';
import transitions from 'gl-transitions';

import { loadImage } from '../../../requestCreator';
import {
  on,
  off,
} from '../../helpers';
import {
  ZINDEX,
  POPCORN_ELEMENT_TYPES,
  KIND,
  FROM,
  TO,
  FROM_URL,
  TO_URL,
  WIDTH,
  HEIGHT,
  BLEND_MODE,
  OPACITY,
} from '../../../constants/popcorn';

import { addDeleteListener, addSelectListener, removeDeleteListener, removeSelectListener } from '../../../mitt/emitter';
import { makeTransition, playTransition } from '../../../utils/transition';
import blendModeConstants from '../../../constants/blendMode';

((Popcorn) => {
  function getDefaultOptionValue(key) {
    const { options } = Popcorn.manifest[POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION];
    if (options && options[key]) {
      return options[key].default;
    }
    return null;
  }

  function setContainer(options) {
    const container = document.createElement('div');

    container.style.position = 'absolute';
    container.style.left = 0;
    container.style.top = 0;
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = options.zindex || getDefaultOptionValue.call(ZINDEX);
    container.style.mixBlendMode = options[BLEND_MODE]
      || getDefaultOptionValue(BLEND_MODE);
    container.style.opacity = options[OPACITY] !== undefined
      ? `${options[OPACITY]}%` : `${getDefaultOptionValue(OPACITY)}%`;

    container.classList.add('video-transition');
    container.setAttribute('id', options.id);

    options._container = container;
  }

  function setCanvas(options) {
    const { _container } = options;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('id', `video-canvas-${options.id}`);
    canvas.setAttribute('crossOrigin', 'anonymous');
    canvas.setAttribute('width', options.width);
    canvas.setAttribute('height', options.height);
    canvas.style.boxSizing = 'border-box';
    canvas.style.position = 'absolute';
    canvas.style.top = '50%';
    canvas.style.left = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.zIndex = 1;

    options._canvas = canvas;
    _container.appendChild(canvas);
  }

  function prepareTransition(options) {
    if (!options.fromUrl || !options.toUrl) {
      return;
    }
    return Promise.all([
      loadImage(options.fromUrl),
      loadImage(options.toUrl),
    ]).then(([imageFrom, imageTo]) => {
      const { _canvas: canvas, kind } = options;

      return makeTransition({
        canvas,
        from: imageFrom,
        to: imageTo,
        kind,
      });
    }).then(({ transition, from, to }) => {
      options.transition = { instance: transition, from, to };
      return options;
    });
  }

  const startTransition = (options) => {
    const { _canvas: canvas, transition: { instance, from, to }, start, end } = options;
    if (canvas && instance && from && to) {
      playTransition({ canvas, from, to, transition: instance, duration: end - start });
    }
  };

  Popcorn.plugin(POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION, {
    manifest: {
      about: {
        name: 'Popcorn Video Transition Plugin',
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
        [KIND]: {
          type: 'select',
          label: 'Select the type of transition',
          items: transitions.map(i => ({ value: i.name, label: i.name })),
          default: { value: 'wind' },
          openMenuOnFocus: true,
        },
        [FROM]: {
          type: 'input',
          label: 'Transition from element:',
          url: '',
          default: '',
          readOnly: true,
        },
        [TO]: {
          type: 'input',
          label: 'Transition to element:',
          url: '',
          default: '',
          readOnly: true,
        },
        [FROM_URL]: {
          url: '',
          default: '',
          hidden: true,
        },
        [TO_URL]: {
          url: '',
          default: '',
          hidden: true,
        },
        [ZINDEX]: {
          default: 1000,
          hidden: true,
        },
        [WIDTH]: {
          default: 0,
          hidden: true,
        },
        [HEIGHT]: {
          default: 0,
          hidden: true,
        },
      },
    },

    _setup(options) {
      let target = Popcorn.dom.find(options.target);
      if (!target) {
        target = this.media.parentNode;
      }
      options._target = target;
      options._context = this;

      setContainer(options);

      removeSelectListener(options._container, options.id);
      addSelectListener(options._container, options.id);
      removeDeleteListener(options._container, options.id);
      addDeleteListener(options._container, options.id);

      off(options._container);
      target.appendChild(options._container);

      extendObservable(options, {
        from: options.from,
        to: options.to,
        fromUrl: options.fromUrl,
        toUrl: options.toUrl,
        kind: options.kind,
        start: options.start,
        end: options.end,
        width: options.width,
        height: options.height,
      });

      requestAnimationFrame(() => {
        setCanvas(options);
        prepareTransition(options);
      });
    },

    start(event, options) {
      const { _container } = options;
      on(_container);
      if (!this.paused()) {
        startTransition(options);
      }
    },

    end(event, options) {
      const { _container } = options;
      off(_container);
      event.transition.instance.dispose();
    },

    async _update(trackEvent, options) {
      if (options.blendMode !== undefined && options.blendMode !== trackEvent.blendMode) {
        trackEvent.blendMode = options.blendMode;
        trackEvent._container.style.mixBlendMode = trackEvent.blendMode;
      }

      if (options.opacity !== undefined && options.opacity !== trackEvent.opacity) {
        trackEvent.opacity = options.opacity;
        trackEvent._container.style.opacity = `${trackEvent.opacity}%`;
      }

      if (options.from !== undefined && options.from !== trackEvent.from) {
        trackEvent.from = options.from;
      }

      if (options.to !== undefined && options.to !== trackEvent.to) {
        trackEvent.to = options.to;
      }

      if (options.fromUrl !== undefined && options.fromUrl !== trackEvent.fromUrl) {
        trackEvent.fromUrl = options.fromUrl;
      }

      if (options.toUrl !== undefined && options.toUrl !== trackEvent.toUrl) {
        trackEvent.toUrl = options.toUrl;
      }

      if (options.kind !== undefined && options.kind !== trackEvent.kind) {
        trackEvent.kind = options.kind;
      }

      if (options.start !== undefined && options.start !== trackEvent.start) {
        trackEvent.start = options.start;
      }

      if (options.end !== undefined && options.end !== trackEvent.end) {
        trackEvent.end = options.end;
      }

      if (options.zindex !== undefined && options.zindex !== trackEvent.zindex) {
        trackEvent.zindex = options.zindex;
        trackEvent._container.style.zIndex = +trackEvent.zindex;
      }

      trackEvent._container.style.zIndex = +trackEvent.zindex;

      await prepareTransition(trackEvent);
    },

    _teardown(options) {
      if (options._target) {
        options._target.removeChild(options._container);
      }
    },
  });
})(window.Popcorn, window.jQuery);
