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
} from '../../../constants/popcorn';

import { addDeleteListener, addSelectListener, removeDeleteListener, removeSelectListener } from '../../../mitt/emitter';
import { makeTransition, playTransition } from '../../../utils/transition';

((Popcorn) => {
  function getDefaultOptionValue(key) {
    const { options } = Popcorn.manifest[POPCORN_ELEMENT_TYPES.JSON_ANIMATION];
    if (options && options[key]) {
      return options[key].default;
    }
    return null;
  }

  async function setContainer(options) {
    return new Promise((resolve) => {
      const container = document.createElement('div');

      container.style.position = 'absolute';
      container.style.left = 0;
      container.style.top = 0;
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.zIndex = options.zindex || getDefaultOptionValue.call(ZINDEX);

      container.classList.add('video-transition');
      container.setAttribute('id', options.id);

      options._container = container;
      resolve(options);
    });
  }

  async function setCanvas(options) {
    return new Promise((resolve) => {
      const { _target: target, _container } = options;
      const { offsetWidth, offsetHeight, style: { marginTop, marginLeft } } = target;

      const canvas = document.createElement('canvas');
      canvas.setAttribute('crossOrigin', 'anonymous');
      canvas.setAttribute('id', 'video-canvas');
      canvas.style.boxSizing = 'border-box';
      canvas.style.position = 'absolute';
      canvas.style.top = 0;
      canvas.style.left = 0;
      canvas.style.zIndex = 1000;
      canvas.setAttribute('width', offsetWidth - (2 * marginLeft));
      canvas.setAttribute('height', offsetHeight - (2 * marginTop));

      options._canvas = canvas;
      _container.appendChild(canvas);

      resolve(options);
    });
  }

  async function prepareTransition(options) {
    if (!options.fromUrl || !options.toUrl) {
      return;
    }

    const { _canvas: canvas, kind } = options;
    const imageFrom = await loadImage(options.fromUrl);
    const imageTo = await loadImage(options.toUrl);

    const { transition, from, to } = await makeTransition({
      canvas,
      from: imageFrom,
      to: imageTo,
      kind,
    });

    options.transition = { instance: transition, from, to };
  }

  const startTransition = (options) => {
    const { _canvas: canvas, transition: { instance, from, to }, start, end } = options;

    playTransition({ canvas, from, to, transition: instance, duration: end - start });
  };

  Popcorn.plugin(POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION, {
    manifest: {
      about: {
        name: 'Popcorn Video Transition Plugin',
        version: '0.1',
        author: 'dbaranoff',
      },
      options: {
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

      await setContainer(options).then(setCanvas).then(prepareTransition);

      removeSelectListener(options._container, options.id);
      addSelectListener(options._container, options.id);
      removeDeleteListener(options._container, options.id);
      addDeleteListener(options._container, options.id);

      extendObservable(options, {
        from: options.from,
        to: options.to,
        fromUrl: options.fromUrl,
        toUrl: options.toUrl,
        kind: options.kind,
        start: options.start,
        end: options.end,
      });

      off(options._container);
      target.appendChild(options._container);
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
