/* eslint-disable no-underscore-dangle,no-new-func,no-useless-escape */

import {
  DEFAULT_EMBED_COMMENT_URL as defaultEmbedCommentUrl,
  DEFAULT_HREF as defaultHref,
  DEFAULT_POST_URL as defaultPostUrl,
  FB_PLUGINS,
  VR_PUBLISHER_APP_ID as vrPublisherAppId,
} from '../../../constants/settings/social';

import { VALIDATION_HREF } from '../../../constants/regExps';

import { POPCORN_ELEMENT_TYPES, SOCIAL_TYPES } from '../../../constants/popcorn';
import { addDeleteListener, emitter, emitterActions, removeDeleteListener, selectItem } from '../../../mitt/emitter';
import { draggableResizable } from '../../helpers';

const fbDataProvider = require('../../utils/facebook-data-provider');


((Popcorn) => {
  function setAttributes(options) {
    let fbAttrs = FB_PLUGINS[options.type];
    const neededFbAttrs = Object.keys(fbAttrs);
    const defaultHrefs = [defaultHref, defaultEmbedCommentUrl, defaultPostUrl];
    let facebookDiv = options._facebookDiv;
    const { attributes } = facebookDiv;
    const attributeNames = [];

    for (let i = 0; i < attributes.length; i++) {
      attributeNames.push(attributes[i].nodeName.replace('data-', ''));
    }

    Popcorn.forEach(fbAttrs, (value, key) => {
      fbAttrs = FB_PLUGINS[options.type];
      facebookDiv = options._facebookDiv;
      let actualWidth;
      let fbWidth;
      let actualHeight;
      let fbHeight;

      if (key === 'width') {
        actualWidth = options.editorWidth || value || fbAttrs.minWidth;
        if (actualWidth < FB_PLUGINS[options.type].minWidth) {
          actualWidth = FB_PLUGINS[options.type].minWidth;
        }
        fbWidth = Math.round(actualWidth).toString();
        // if (options.type === SOCIAL_TYPES.FB_COMMENTS) {
        //   console.log(options.width);
        //
        //   // const optionsWidth = options.width < 100;
        //   // let newWidthInPx;
        //   // if (optionsWidth) {
        //   //   newWidthInPx = (targetWidth / 100) * options.width;
        //   // } else {
        //   //   newWidthInPx = 500;
        //   // }
        //
        //   // if (newWidthInPx < FB_PLUGINS[SOCIAL_TYPES.FB_COMMENTS].minWidth) {
        //   //   trackEvent.width = FB_PLUGINS[SOCIAL_TYPES.FB_COMMENTS].minWidth;
        //   // }
        //   // ========================================
        //   fbWidth = '100%';
        //   if (options[key] && options[key] < 100) { // percents
        //     const targetWidth = options._target.clientWidth;
        //     const widthInPx = (targetWidth / 100) * options[key];
        //     if (widthInPx < FB_PLUGINS[options.type].minWidth) {
        //       options._container.style.width = `${FB_PLUGINS[options.type].minWidth}px`;
        //     } else {
        //       options._container.style.width = `${options[key]}%`;
        //     }
        //   }
        //   if ((options[key] && options[key] > 100) || !options[key]) { // px
        //     options._container.style.width = `${FB_PLUGINS[options.type].minWidth + 20}px`;
        //   }
        // }
        return facebookDiv.setAttribute('data-width', fbWidth);
      }

      if (key === 'height' && options.type === SOCIAL_TYPES.FB_PAGE) {
        actualHeight = options.editorHeight || value || fbAttrs.minHeight;
        fbHeight = Math.round(actualHeight).toString();
        return facebookDiv.setAttribute('data-height', fbHeight);
      }

      if (key === 'height') {
        options._container.style.height = 'auto';
      }

      if (key === 'height' && options.type === SOCIAL_TYPES.FB_COMMENTS) {
        if (options.editorHeight && options.editorHeight < 100) {
          options._container.style.height = `${options.editorHeight}%`;
        }
      }

      facebookDiv.setAttribute(`data-${key}`, options[key] || value);
    });

    if (defaultHrefs.indexOf(options.href) !== -1) {
      facebookDiv.setAttribute('data-href', fbAttrs.href);
      options.href = fbAttrs.href;
    }

    const typeChanged = !options._facebookDiv.classList.contains(options.type);

    if (typeChanged) {
      facebookDiv.setAttribute('class', options.type);

      // remove attributes we do not need
      Popcorn.forEach(attributeNames, (attribute) => {
        if (neededFbAttrs.indexOf(attribute) === -1) {
          facebookDiv.removeAttribute(`data-${attribute}`);
          delete options[attribute];
        }
      });
    }
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
        const fn = new Function('options', options.scripts[key]);
        options.scripts._compiled[key] = () => fn.apply(fn, [{
          event: options,
        }]);
      });
    }
  }

  Popcorn.plugin(POPCORN_ELEMENT_TYPES.SOCIAL, {
    manifest: {
      about: {
        name: 'Popcorn Social Plugin',
        version: '0.1',
        author: 'Eugenia Rakhmatova: @mstmustisnt',
        website: 'digistrats.com',
      },
      defaultOptions: FB_PLUGINS,
      options: {
        start: {
          type: 'time',
          label: 'Start',
          units: 'seconds',
          className: 'social-settings__time',
        },
        end: {
          type: 'time',
          label: 'End',
          className: 'social-settings__time',
        },
        type: {
          type: 'select',
          items: [
            { label: 'Like button', value: 'fb-like' },
            { label: 'Comments', value: 'fb-comments' },
            { label: 'Page', value: 'fb-page' },
            { label: 'Embedded comments', value: 'fb-comment-embed' },
            { label: 'Embedded posts', value: 'fb-post' },
          ],
          label: 'Plugin type',
          default: 'fb-like',
          className: 'social-settings__input',
        },
        // optional parameters:
        href: {
          type: 'input',
          validation: VALIDATION_HREF,
          label: 'URL',
          className: 'social-settings__input',
        },
        'include-parent': {
          elem: 'input',
          type: 'checkbox',
          optional: true,
          label: 'Include parent comment',
          hidden: true,
        },
        width: {
          type: 'slider',
          label: 'Width',
          optional: true,
        },
        height: {
          type: 'slider',
          label: 'Height',
          optional: true,
        },
        editorWidth: {
          type: 'slider',
          label: 'Width',
          optional: true,
        },
        editorHeight: {
          type: 'slider',
          label: 'Height',
          optional: true,
        },
        zindex: {
          hidden: true,
        },
        top: {
          type: 'number',
          label: 'Top',
          default: 0,
          hidden: true,
        },
        left: {
          type: 'number',
          label: 'Left',
          default: 0,
          hidden: true,
        },
        background: {
          type: 'color',
          label: 'Background',
          default: 'rgb(255, 255, 255, 1)',
          className: 'social-settings__color',
        },
        scripts: {
          onStart: '',
          onEnd: '',
          hidden: true,
        },
      },
    },

    _setup(options) {
      let target = Popcorn.dom.find(options.target);
      let videoContainerDiv;

      options._context = this;
      options.stopMove = false;

      options._container = document.createElement('div');
      options._container.id = `facebookDiv-${Popcorn.guid()}`;
      options._container.classList.add('social-plugin-div');
      options._facebookDiv = document.createElement('div');
      options._container.appendChild(options._facebookDiv);
      options._container.style.background = options.background
        || options._natives.manifest.options.background.default;

      options.type = options.type || SOCIAL_TYPES.FB_LIKE;
      options.href = options.href || FB_PLUGINS[options.type].href;
      options.top = options.top ?? options._natives.manifest.options.top.default;
      options.left = options.left ?? options._natives.manifest.options.left.default;
      options.stopResize = true;

      if (!target) {
        target = this.media.parentNode;
      }

      if (target) {
        target.appendChild(options._container);
        options._target = target;
      }

      setAttributes(options);
      options._container.style.position = 'absolute';
      options._container.style.top = `${options.top}%`;
      options._container.style.left = `${options.left}%`;
      options._container.style.zIndex = options.zindex;
      options._container.style.maxHeight = '100%';
      options._container.style.overflow = 'hidden';

      const wrapper = document.createElement('div');
      wrapper.classList.add('social-wrapper');
      wrapper.setAttribute('tabIndex', -1);
      options._container.appendChild(wrapper);

      // facebook script requires a div named fb-root
      if (!document.getElementById('fb-root')) {
        const fbRoot = document.createElement('div');
        fbRoot.setAttribute('id', 'fb-root');
        document.body.appendChild(fbRoot);
      }

      options.toString = function () {
        if (options.type) {
          return FB_PLUGINS[options.type].title;
        }

        return 'Social Plugin';
      };

      if (!window.FB) {
        fbDataProvider.init(vrPublisherAppId);
      } else if (window.FB.XFBML) {
        const socialDivs = videoContainerDiv
          && videoContainerDiv.querySelectorAll('.social-plugin-div');
        if (socialDivs && socialDivs.length > 0) {
          socialDivs.forEach((socialDiv) => {
            window.FB.XFBML.parse(socialDiv);
          });
        } else {
          window.FB.XFBML.parse(options._container);
        }
      }

      removeDeleteListener(options._container, options.id);
      addDeleteListener(options._container, options.id);

      const selectElement = event => {
        event.stopPropagation();
        selectItem(event, options.id);
      };

      const emitterSelectItem = id => {
        const isSelected = id === options.id;
        if (options && options._container) {
          options._container.classList[isSelected ? 'add' : 'remove']('active');
        }

        if (isSelected) {
          draggableResizable({ ...options, _container: options._container }, null, { ratio: 'preserve' });
        }
      };

      options._container.addEventListener('click', selectElement);
      emitter.on(emitterActions.SELECT, emitterSelectItem);

      buildScripts(options);
    },

    /**
       * @member facebook
       * The start function will be executed when the currentTime
       * of the video reaches the start time provided by the
       * options variable
       */
    start(event, options) {
      options._container.style.display = '';

      buildScripts(options);
      if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
        options.scripts._compiled.onStart();
      }
    },
    /**
       * @member facebook
       * The end function will be executed when the currentTime
       * of the video reaches the end time provided by the
       * options variable
       */
    end(event, options) {
      options._container.style.display = 'none';
      buildScripts(options);
      if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
        options.scripts._compiled.onEnd();
      }
    },
    _update(trackEvent, options) {
      if (options.left && options.left !== trackEvent.left) {
        trackEvent.left = options.left;
      }

      if (options.top && options.top !== trackEvent.top) {
        trackEvent.top = options.top;
      }

      if (options.background && options.background !== trackEvent.background) {
        trackEvent.background = options.background;
        trackEvent._container.style.background = options.background;
      }

      if (options.type) {
        trackEvent.editorWidth = FB_PLUGINS[options.type].width;
        trackEvent.editorHeight = FB_PLUGINS[options.type].height || null;
        trackEvent._context.emit('elementUpdated', {
          type: 'social',
          element: trackEvent,
          options: {
            editorWidth: FB_PLUGINS[options.type].width,
            editorHeight: FB_PLUGINS[options.type].height || null,
            title: FB_PLUGINS[options.type].title,
            top: 0,
            left: 0,
            width: null,
            minWidth: FB_PLUGINS[options.type].minWidth,
            maxWidth: FB_PLUGINS[options.type].maxWidth,
          },
        });
      }
    },
    _teardown(options) {
      const target = document.getElementById(options.target);

      if (target) {
        target.removeChild(options._container);
      }
    },
  });
})(window.Popcorn);
