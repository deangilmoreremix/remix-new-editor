/* eslint-disable no-underscore-dangle,no-new-func */

import {
  POPCORN_ELEMENT_TYPES,
  START,
  END,
  BLEND_MODE,
  OPACITY,
  LEFT,
  TOP,
  WIDTH,
  HEIGHT,
  ZINDEX,
} from '../../../constants/popcorn';
import { TIME } from '../../../constants/forms';
import { addDeleteListener, emitter, emitterActions, removeDeleteListener, selectItem } from '../../../mitt/emitter';
import { draggableResizable, removeHandleElements } from '../../helpers';
import blendModeConstants from '../../../constants/blendMode';
import { off, updateTrackEvent } from '../../../utils/popcorn-helper';

const updateFields = [TOP, LEFT, WIDTH, HEIGHT, ZINDEX, BLEND_MODE, OPACITY];

function isSafari() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('safari') !== -1) {
    return ua.indexOf('chrome') === -1;
  }
  return false;
}

((Popcorn) => {
  function getDefaultOptionValue(key) {
    const { options } = Popcorn.manifest[POPCORN_ELEMENT_TYPES.COMBINED];
    if (options && options[key]) {
      return options[key].default;
    }
    return null;
  }

  Popcorn.plugin('combined', {
    manifest: {
      about: {
        name: 'Popcorn CombinedEvents Plugin',
        version: '1.0',
        author: 'Sergey',
      },
      options: {
        [START]: {
          type: TIME,
          label: 'Start',
          default: 0,
          className: 'input-loop-start',
        },
        [END]: {
          type: TIME,
          label: 'End',
          default: 0,
          className: 'input-loop-end',
        },
        [BLEND_MODE]: {
          default: blendModeConstants.normal.value,
          hidden: true,
        },
        [OPACITY]: {
          default: 100,
          hidden: true,
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
          default: 25,
          hidden: true,
        },
        [ZINDEX]: {
          default: 1000,
          hidden: true,
        },
      },
    },
    _setup(options) {
      const _target = Popcorn.dom.find(options.target);
      options._target = _target;
      options._context = this;
      let container = null;
      container = document.createElement('div');

      container.style.position = 'absolute';
      container.style.mixBlendMode = options[BLEND_MODE]
        || getDefaultOptionValue(BLEND_MODE);
      container.style.opacity = options[OPACITY] !== undefined
        ? `${options[OPACITY]}%` : `${getDefaultOptionValue(OPACITY)}%`;
      container.classList.add('popcorn-combined');
      container.style.left = `${options.left ?? getDefaultOptionValue(LEFT)}%`;
      container.style.top = `${options.top ?? getDefaultOptionValue(TOP)}%`;
      container.style.width = `${options.width ?? getDefaultOptionValue(WIDTH)}%`;
      container.style.height = `${options.height ?? getDefaultOptionValue(HEIGHT)}%`;
      container.style.zIndex = options.zindex !== undefined
        ? +options.zindex : getDefaultOptionValue(ZINDEX);

      container.setAttribute('tabIndex', -1);

      container.classList.add('off');
      options._container = container;

      removeDeleteListener(options._container, options.id);
      addDeleteListener(options._container, options.id);

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
          draggableResizable(
            { ...options, _container: options._container },
            null,
            { equalDelta: true },
          );
        } else {
          removeHandleElements(options._container);
        }
      });

      if (_target && container) {
        _target.appendChild(container);
        options.items.forEach(item => {
          this[item.type]({
            ...item,
            start: options.start + item.startDifference,
            end: options.end - item.endDifference,
            target: container,
            combined: true,
          });
        });
      }
    },
    start(event, options) {
      if (!isSafari()) {
        const container = options._container;

        if (container) {
          container.classList.add('on');
          container.classList.remove('off');
        }
      } else {
        setTimeout(() => {
          const container = options._container;

          if (container) {
            container.classList.add('on');
            container.classList.remove('off');
          }
        }, 430);
      }
    },
    end(event, options) {
      off(options._container);
    },
    _update(trackEvent, options) {
      if ((options.newSize || options.width || options.height) && trackEvent._container) {
        trackEvent.items.forEach(item => {
          if (item.type === POPCORN_ELEMENT_TYPES.TEXT) {
            const domTextElements = document.getElementById(item.id);
            trackEvent._container.removeChild(domTextElements);
          }
        });

        trackEvent.items.forEach(item => {
          if (item.type === POPCORN_ELEMENT_TYPES.TEXT) {
            trackEvent._context[item.type]({
              ...item,
              start: trackEvent.start + item.startDifference,
              end: trackEvent.end - item.endDifference,
              target: trackEvent._container,
              combined: true,
            });
          }
        });
      }

      if (!options.combinedItemId) {
        trackEvent = updateTrackEvent(updateFields, trackEvent, options);
      }

      if (options.combinedItemId && trackEvent._container) {
        for (let i = 0; i < trackEvent.items.length; i++) {
          if (trackEvent.items[i].id === options.combinedItemId) {
            const domTextElements = document.getElementById(trackEvent.items[i].id);
            trackEvent._container.removeChild(domTextElements);
            trackEvent._context[trackEvent.items[i].type]({
              ...trackEvent.items[i],
              ...options,
              start: trackEvent.start + trackEvent.items[i].startDifference,
              end: trackEvent.end - trackEvent.items[i].endDifference,
              target: trackEvent._container,
              combined: true,
            });
            trackEvent.items[i] = { ...trackEvent.items[i], ...options };
            delete trackEvent.items[i].combinedItemId;
            return;
          }
        }
      }

      trackEvent._container.style.left = `${trackEvent.left}%`;
      trackEvent._container.style.width = `${trackEvent.width}%`;
      trackEvent._container.style.height = `${trackEvent.height}%`;
      trackEvent._container.style.top = `${trackEvent.top}%`;
      trackEvent._container.style.zIndex = +trackEvent.zindex;
      trackEvent._container.style.mixBlendMode = trackEvent.blendMode;
      trackEvent._container.style.opacity = `${trackEvent.opacity}%`;
    },
    frame() {
    },
    _teardown(options) {
      if (options._target) {
        options._target.removeChild(options._container);
      }
    },
  });
})(window.Popcorn);
