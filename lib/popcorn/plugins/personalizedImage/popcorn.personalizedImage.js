/* eslint-disable no-underscore-dangle,no-new-func,no-useless-escape */
// PLUGIN: PERSONALIZED IMAGE
import { draggableResizable } from '../../helpers';
import {
  addDeleteListener, emitter, emitterActions,
  removeDeleteListener,
  selectItem,
} from '../../../mitt/emitter';
import blendModeConstants from '../../../constants/blendMode';
import {
  POPCORN_ELEMENT_TYPES,
  BLEND_MODE,
  TOP,
  LEFT,
  SRC,
  LINKSRC,
  WIDTH,
  HEIGHT,
  CORNER_RADIUS,
  BACKGROUND,
  BACKGROUND_COLOR,
  TITLE,
  TRANSITION,
  ROTATION,
  START,
  END,
  ZINDEX,
  SCRIPTS,
  HTML_LINK_URL,
  HTML_SRC,
  INNER_TOP,
  INNER_LEFT,
  INNER_WIDTH,
  INNER_HEIGHT,
  OPACITY,
} from '../../../constants/popcorn';

import { CONTENTEDITABLE_TEXTAREA } from '../../../constants/forms';
import { CARET_FIELDS } from '../../../constants/tokens';
// const interact = require('interactjs');

const { extendObservable } = require('mobx');
const { wrapTokens } = require('../../../../lib/utils/tokens-helper');

function isSafari() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('safari') !== -1) {
    return ua.indexOf('chrome') === -1;
  }
  return false;
}

((Popcorn) => {
  const PLACEHOLDER_URL = 'https://cdn.vidcloud.io/src/plugins/personalizedImage/personalizedImage-placeholder.svg';

  const urlRegex = /[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/;

  function validateDimension(value, fallback) {
    if (typeof value === 'number') {
      return value;
    }
    return fallback;
  }

  function buildScripts(options) {
    if (!options.scripts) {
      options.scripts = {};

      Object.keys(options._natives.manifest.options.scripts).forEach((key) => {
        options.scripts[key] = '';
      });
    } else {
      options.scripts._compiled = options.scripts._compiled || {};

      Object.keys(options._natives.manifest.options.scripts).forEach((key) => {
        /* jslint evil: true */
        const fn = new Function('options', options.scripts[key]);
        options.scripts._compiled[key] = () => fn.apply(fn, [{
          event: options,
        }]);
      });
    }
  }

  function getDefaultOptionValue(key) {
    const { options } = Popcorn.manifest[POPCORN_ELEMENT_TYPES.PERSONALIZED_IMAGE];
    if (options && options[key]) {
      return options[key].default;
    }
    return null;
  }

  function createImageDiv(element, imageUrl) {
    const link = document.createElement('div');
    const imageDiv = document.createElement('div');
    link.classList.add('image-plugin-link');
    imageDiv.classList.add('image-plugin-img');

    imageDiv.style.backgroundImage = `url( ${imageUrl} )`;
    link.appendChild(imageDiv);

    return link;
  }

  Popcorn.plugin('personalizedImage', {

    _setup(options) {
      const _this = this;
      let _link;
      let _image;

      function toFillOptions(field) {
        if (options[field] !== undefined) {
          return options[field];
        } else {
          return options._natives.manifest.options[field].default;
        }
      }

      const _target = Popcorn.dom.find(options.target);
      const _container = document.createElement('div');

      function setupImageDiv() {
        _container.appendChild(_link);
        _image = _link.querySelector('.image-plugin-img');
        _image.style.left = `${validateDimension(options.innerLeft, '0')}%`;
        _image.style.top = `${validateDimension(options.innerTop, '0')}%`;
        if (options.innerHeight) {
          _image.style.height = `${validateDimension(options.innerHeight, '0')}%`;
        }
        if (options.innerWidth) {
          _image.style.width = `${validateDimension(options.innerWidth, '0')}%`;
        }

        options.link = _link;
        options.image = _image;
      }

      options._target = _target;
      options._container = _container;
      options._context = _this;

      options.linkSrc = toFillOptions(LINKSRC);
      options.src = toFillOptions(SRC);

      options.htmlUrl = wrapTokens(options.linkSrc);
      options.htmlSrc = wrapTokens(options.src);

      removeDeleteListener(_container, options.id);
      addDeleteListener(_container, options.id);

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
          draggableResizable({ ...options, _container }, null, { ratio: 'preserve' });
        }
      });

      _container.classList.add('personalized-image');
      _container.setAttribute('tabIndex', -1);
      _container.style.width = `${validateDimension(options.width, '100')}%`;
      _container.style.height = `${validateDimension(options.height, '100')}%`;
      _container.style.top = `${validateDimension(options.top, '0')}%`;
      _container.style.left = `${validateDimension(options.left, '0')}%`;
      _container.style.zIndex = +options.zindex;
      _container.style.mixBlendMode = options[BLEND_MODE]
        || getDefaultOptionValue(BLEND_MODE);
      _container.style.opacity = options[OPACITY] !== undefined
        ? `${options[OPACITY]}%` : `${getDefaultOptionValue(OPACITY)}%`;
      _container.classList.add(
        options.transition
        || Popcorn.manifest[POPCORN_ELEMENT_TYPES.PERSONALIZED_IMAGE]
          .options.transition.options[0].value,
      );
      _container.classList.add('off');

      const rotation = options.rotation || 0;
      _container.style.transform = `rotate(${rotation}deg)`;
      _container.style['-webkit-transform'] = `rotate(${rotation}deg)`;
      _container.style['-moz-transform'] = `rotate(${rotation}deg)`;
      _container.style['-ms-transform'] = `rotate(${rotation}deg)`;

      if (_target) {
        _target.appendChild(_container);

        const arr = options.src.replace(/[{}]/g, '').split(' ');
        let imageUrl = PLACEHOLDER_URL;
        if (arr[0] === 'd') {
          // eslint-disable-next-line prefer-destructuring
          imageUrl = arr[2];
        }
        _link = createImageDiv(options, imageUrl);
        setupImageDiv();

        options.toString = () => {
          let _splitSource = [];
          if (options.title) {
            return options.title;
          } else if (/^data:/.test(options.src)) {
            // might ba a data URI
            return `${options.src.substring(0, 30)}...`;
          } else if (options.src) {
            _splitSource = options.src.split('/');
            return _splitSource[_splitSource.length - 1];
          }
          return 'Image Plugin';
        };
      }

      options.link.style.borderRadius = `${options.cornerRadius || 0}%`;
      if (options.background) {
        options.link.style.background = options.backgroundColor;
      }

      buildScripts(options);
      extendObservable(options, {
        src: options.src,
        innerTop: options.innerTop,
        innerLeft: options.innerLeft,
        innerWidth: options.innerWidth,
        background: options.background,
        innerHeight: options.innerHeight,
        cornerRadius: options.cornerRadius,
        backgroundColor: options.backgroundColor,
        top: +options.top || getDefaultOptionValue(TOP),
        left: +options.left || getDefaultOptionValue(LEFT),
        urlCaretOffset: options.urlCaretOffset,
      });

      options._activeHandle = {
        type: 'src',
        target: options.urlContainer,
      };
    },

    start(event, options) {
      if (!isSafari()) {
        const container = options._container;

        if (container) {
          if (options._updateImage) {
            this.on('timeupdate', options._updateImage);
          }

          container.classList.add('on');
          container.classList.remove('off');

          // Safari Redraw hack - #3066
          container.style.display = 'none';
          container.style.display = '';
        }

        buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
          options.scripts._compiled.onStart();
        }
      } else {
        setTimeout(() => {
          const container = options._container;

          if (container) {
            if (options._updateImage) {
              this.on('timeupdate', options._updateImage);
            }

            container.classList.add('on');
            container.classList.remove('off');

            // Safari Redraw hack - #3066
            container.style.display = 'none';
            container.style.display = '';
          }

          buildScripts(options);
          if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
            options.scripts._compiled.onStart();
          }
        }, 430);
      }
    },

    _update(trackEvent, options) {
      if (options.innerLeft !== undefined && options.innerLeft !== trackEvent.innerLeft) {
        trackEvent.innerLeft = options.innerLeft;
      }

      if (options.innerTop !== undefined && options.innerTop !== trackEvent.innerTop) {
        trackEvent.innerTop = options.innerTop;
      }

      if (options.innerHeight !== undefined && options.innerHeight !== trackEvent.innerHeight) {
        trackEvent.innerHeight = options.innerHeight;
      }

      if (options.innerWidth !== undefined && options.innerWidth !== trackEvent.innerWidth) {
        trackEvent.innerWidth = options.innerWidth;
      }

      if (options.width !== undefined && options.width !== trackEvent.width) {
        trackEvent.width = options.width;
        trackEvent._container.style.width = `${validateDimension(trackEvent.width, '100')}%`;
      }

      if (options.height !== undefined && options.height !== trackEvent.height) {
        trackEvent.height = options.height;
        trackEvent._container.style.height = `${validateDimension(trackEvent.height, '100')}%`;
      }

      if (options.top !== undefined && options.top !== trackEvent.top) {
        trackEvent.top = options.top;
        trackEvent._container.style.top = `${validateDimension(trackEvent.top, '0')}%`;
      }

      if (options.left !== undefined && options.left !== trackEvent.left) {
        trackEvent.left = options.left;
        trackEvent._container.style.left = `${validateDimension(trackEvent.left, '0')}%`;
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

      if (options.transition !== undefined && options.transition !== trackEvent.transition) {
        trackEvent.transition = options.transition;
        trackEvent._container.classList.add(trackEvent.transition);
      }

      if (options.rotation !== undefined && options.rotation !== trackEvent.rotation) {
        trackEvent.rotation = options.rotation;
        trackEvent._container.style.transform = `rotate(${trackEvent.rotation || 0}deg)`;
        trackEvent._container.style['-webkit-transform'] = `rotate(${trackEvent.rotation || 0}deg)`;
        trackEvent._container.style['-moz-transform'] = `rotate(${trackEvent.rotation || 0}deg)`;
        trackEvent._container.style['-ms-transform'] = `rotate(${trackEvent.rotation || 0}deg)`;
      }

      if (options.cornerRadius !== undefined && options.cornerRadius !== trackEvent.cornerRadius) {
        trackEvent.cornerRadius = options.cornerRadius;
      }

      if (options.background !== undefined && options.background !== trackEvent.background) {
        trackEvent.background = options.background;
      }

      if (options.backgroundColor !== undefined
        && options.backgroundColor !== trackEvent.backgroundColor) {
        trackEvent.backgroundColor = options.backgroundColor;
      }

      if ((options.src !== undefined && options.src !== trackEvent.src)) {
        if (options.src !== undefined) {
          trackEvent.src = options.src;
        }
        trackEvent._container.removeChild(trackEvent._container.querySelector('.image-plugin-link'));

        const arr = options.src.replace(/[{}]/g, '').split(' ');
        let imageUrl = PLACEHOLDER_URL;
        if (arr[0] === 'd') {
          // eslint-disable-next-line prefer-destructuring
          imageUrl = arr[2];
        }

        const _link = createImageDiv(trackEvent, imageUrl);
        trackEvent._container.appendChild(_link);
        const _image = _link.querySelector('.image-plugin-img');
        trackEvent.link = _link;
        trackEvent.image = _image;
      }

      if (options.linkSrc !== undefined && options.linkSrc !== trackEvent.linkSrc) {
        trackEvent.linkSrc = options.linkSrc;
      }

      if ((options.title !== undefined && options.title !== trackEvent.title)) {
        trackEvent.title = options.title;
      }

      trackEvent.image.style.left = `${validateDimension(trackEvent.innerLeft, '0')}%`;
      trackEvent.image.style.top = `${validateDimension(trackEvent.innerTop, '0')}%`;
      if (trackEvent.innerHeight) {
        trackEvent.image.style.height = `${validateDimension(trackEvent.innerHeight, '100')}%`;
      }
      if (trackEvent.innerWidth) {
        trackEvent.image.style.width = `${validateDimension(trackEvent.innerWidth, '100')}%`;
      }
      trackEvent.link.style.borderRadius = `${trackEvent.cornerRadius || 0}%`;
      if (trackEvent.background) {
        trackEvent.link.style.background = trackEvent.backgroundColor;
      } else {
        trackEvent.link.style.background = 'unset';
      }
    },

    end(event, options) {
      if (!isSafari()) {
        if (options._container) {
          if (options._updateImage) {
            this.off('timeupdate', options._updateImage);
          }

          options._container.classList.add('off');
          options._container.classList.remove('on');
        }

        buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
          options.scripts._compiled.onEnd();
        }
      } else {
        setTimeout(() => {
          if (options._container) {
            if (options._updateImage) {
              this.off('timeupdate', options._updateImage);
            }

            options._container.classList.add('off');
            options._container.classList.remove('on');
          }

          buildScripts(options);
          if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
            options.scripts._compiled.onEnd();
          }
        }, 430);
      }
    },

    _teardown(options) {
      if (options._updateImage) {
        this.off(options._updateImage);
      }
      options._container.parentNode.removeChild(options._container);
      delete options._container;
    },

    manifest: {
      about: {
        name: 'Popcorn image Plugin',
        version: '0.1',
        author: 'cadecairos',
        website: 'https://chrisdecairos.ca/',
      },
      options: {
        target: 'video-overlay',
        [BLEND_MODE]: {
          default: blendModeConstants.normal.value,
          hidden: true,
        },
        [OPACITY]: {
          default: 100,
          hidden: true,
        },
        [SRC]: {
          type: 'tags',
          label: 'Param Name',
          default: '{{image}}',
        },
        [LINKSRC]: {
          type: 'tags',
          label: 'Link SRC',
          validation: urlRegex,
        },
        [HTML_SRC]: {
          name: HTML_SRC,
          type: CONTENTEDITABLE_TEXTAREA,
          label: 'Param Name',
          placeholder: 'www.example.com',
          additionalFieldName: SRC,
          default: wrapTokens('{{image}}'),
          caretName: CARET_FIELDS[HTML_SRC],
        },
        [HTML_LINK_URL]: {
          name: HTML_LINK_URL,
          type: CONTENTEDITABLE_TEXTAREA,
          label: 'URL',
          placeholder: 'www.example.com',
          additionalFieldName: LINKSRC,
          caretName: CARET_FIELDS[HTML_LINK_URL],
        },
        [WIDTH]: {
          type: 'number',
          label: 'Width',
          default: 100,
          hidden: true,
        },
        [CORNER_RADIUS]: {
          type: 'number',
          label: 'Corner Radius',
          default: 0,
          hidden: true,
        },
        [HEIGHT]: {
          type: 'number',
          label: 'Height',
          default: 100,
          hidden: true,
        },
        [TOP]: {
          type: 'number',
          label: 'Top',
          default: 0,
          hidden: true,
        },
        [LEFT]: {
          type: 'number',
          label: 'Left',
          default: 0,
          hidden: true,
        },
        [INNER_TOP]: {
          type: 'number',
          default: 0,
          hidden: true,
        },
        [INNER_LEFT]: {
          type: 'number',
          default: 0,
          hidden: true,
        },
        [INNER_WIDTH]: {
          type: 'number',
          default: 0,
          hidden: true,
        },
        [INNER_HEIGHT]: {
          type: 'number',
          default: 0,
          hidden: true,
        },
        [BACKGROUND]: {
          type: 'checkbox',
          label: 'Background',
          default: false,
          hidden: true,
        },
        [BACKGROUND_COLOR]: {
          type: 'color',
          label: 'Background color',
          hidden: true,
        },
        [TITLE]: {
          type: 'input',
          label: 'Image Title',
          default: '',
        },
        [TRANSITION]: {
          type: 'select',
          options: ['None', 'Pop', 'Slide Up', 'Slide Down', 'Fade', 'Fade In', 'Fade In Up'],
          values: ['popcorn-none', 'popcorn-pop', 'popcorn-slide-up', 'popcorn-slide-down', 'popcorn-fade', 'popcorn-fade-in', 'popcorn-fade-in-up'],
          label: 'Transition',
          default: 'popcorn-fade',
          hidden: true,
        },
        [ROTATION]: {
          type: 'angle',
          label: 'Rotation',
          default: 0,
        },
        [START]: {
          type: 'time',
          label: 'Start',
        },
        [END]: {
          type: 'time',
          label: 'End',
        },
        [ZINDEX]: {
          hidden: true,
        },
        [SCRIPTS]: {
          onStart: '',
          onEnd: '',
        },
      },
    },
  });
})(window.Popcorn);
