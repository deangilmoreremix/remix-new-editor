/* eslint-disable space-in-parens,no-underscore-dangle,no-new-func,no-multi-assign,prefer-destructuring,no-var,vars-on-top,no-shadow,camelcase,block-scoped-var,no-use-before-define,no-plusplus,no-undef,max-len,no-throw-literal,no-unused-vars,global-require,import/no-dynamic-require,import/no-amd,radix */


define([], () => {
  const Popcorn = window.Popcorn;
  const urlRegex = /[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?/;
  const defaultHref = 'https://www.facebook.com/facebook';
  const defaultPostUrl = 'https://www.facebook.com/20531316728/posts/10154009990506729';
  const defaultEmbedCommentUrl = 'https://www.facebook.com/zuck/posts/10102577175875681?comment_id=1193531464007751&reply_comment_id=654912701278942';
  const vrPublisherAppId = '1728968890675795';
  const FB_PLUGINS = {
    'fb-like': {
      title: 'Like',
      'show-faces': true,
      layout: 'standard',
      action: 'like',
      width: 450, // should be >=225px, height is static:  35 w/o faces, 80 w/
      minWidth: 225,
      share: true,
      href: defaultHref,
    },
    'fb-comments': {
      title: 'Comments',
      numposts: 5,
      width: 550,
      minWidth: 320,
      href: defaultHref,
    },
    'fb-comment-embed': {
      title: 'Embedded Comments',
      'include-parent': false,
      width: 560,
      minWidth: 220,
      href: defaultEmbedCommentUrl,
    },
    'fb-post': {
      title: 'Post',
      href: defaultPostUrl,
      width: 500,
      minWidth: 350,
      maxWidth: 750,
    },
    'fb-page': {
      title: 'Page',
      tabs: 'timeline',
      'small-header': false,
      'adapt-container-width': true,
      'hide-cover': false,
      'show-face-pile': true,
      width: 340, // between 180 and 500
      minWidth: 180,
      maxWidth: 500,
      height: 500,
      minHeight: 130, // in FB docs min height is defined to be 70px, but actually FB never sets it to value less than 130px
      href: defaultHref,
    },
    defaultHrefs: [defaultEmbedCommentUrl, defaultHref, defaultPostUrl],
  };

  function setAttributes(options) {
    const fbAttrs = FB_PLUGINS[options.type];
    const neededFbAttrs = Object.keys(fbAttrs);
    const defaultHrefs = [defaultHref, defaultEmbedCommentUrl, defaultPostUrl];
    const facebookDiv = options._facebookDiv;
    const attributes = facebookDiv.attributes;
    const attributeNames = [];
    const oldHref = facebookDiv.getAttribute('data-href');
    const oldWidth = facebookDiv.getAttribute('data-width');
    const oldHeight = facebookDiv.getAttribute('data-height');
    const oldIncludeParent = facebookDiv.getAttribute('data-include-parent') || '';

    for (var i = 0; i < attributes.length; i++) {
      attributeNames.push(attributes[i].nodeName.replace('data-', ''));
    }

    Popcorn.forEach(fbAttrs, (value, key) => {
      const fbAttrs = FB_PLUGINS[options.type];
      const facebookDiv = options._facebookDiv;
      const target = options._target;
      let actualWidth;
      let fbWidth;
      let actualHeight;
      let fbHeight;

      if (key === 'width') {
        if (window.Butter) {
          actualWidth = options.editorWidth || fbAttrs.minWidth;
        } else {
          actualWidth = options[key] ? (options[key] * target.clientWidth) / 100
            : options.editorWidth || fbAttrs.minWidth;
        }

        fbWidth = Math.round(actualWidth).toString();
        return facebookDiv.setAttribute('data-width', fbWidth);
      }

      if (key === 'height' && options.type === 'fb-page') {
        if (window.Butter) {
          actualHeight = options.editorHeight || fbAttrs.minHeight;
        } else {
          actualHeight = options[key] ? (options[key] * target.clientHeight) / 100
            : options.editorHeight || fbAttrs.minHeight;
        }

        fbHeight = Math.round(actualHeight).toString();
        return facebookDiv.setAttribute('data-height', fbHeight);
      }

      facebookDiv.setAttribute(`data-${key}`, options[key] || value);
    });

    if (defaultHrefs.indexOf(options.href) !== -1) {
      facebookDiv.setAttribute('data-href', fbAttrs.href);
      options.href = fbAttrs.href;
    }

    const newWidth = options.editorWidth;
    const newHeight = options.editorHeight;
    const hrefChanged = (oldHref !== options.href);
    const typeChanged = !options._facebookDiv.classList.contains(options.type);
    const widthChanged = newWidth && (parseInt(oldWidth) !== newWidth);
    let heightChanged;
    const includeParentChanged = ((oldIncludeParent
      !== (options['include-parent'] && options['include-parent'].toString()) || ''));

    if (!typeChanged && (options.type === 'fb-page')) {
      heightChanged = newHeight && (parseInt(oldHeight) !== newHeight);
    }
    const somethingChanged = hrefChanged || typeChanged || widthChanged || heightChanged || includeParentChanged;

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

    if (window.FB && somethingChanged) {
      window.fbAsyncInit();
    }

    // handle cases when FB has set different width or height

    if (widthChanged || typeChanged) {
      if (FB_PLUGINS[options.type].maxWidth && (newWidth > FB_PLUGINS[options.type].maxWidth)) {
        options._container.style.width = `${FB_PLUGINS[options.type].maxWidth}px`;
      }

      if (FB_PLUGINS[options.type].minWidth && (newWidth < FB_PLUGINS[options.type].minWidth)) {
        options._container.style.width = `${FB_PLUGINS[options.type].minWidth}px`;
      }
    }

    if (heightChanged || typeChanged) {
      if (FB_PLUGINS[options.type].maxHeight && (newHeight > FB_PLUGINS[options.type].maxHeight)) {
        options._container.style.height = `${FB_PLUGINS[options.type].maxHeight}px`;
      }

      if (FB_PLUGINS[options.type].minHeight && (newHeight < FB_PLUGINS[options.type].minHeight)) {
        options._container.style.height = `${FB_PLUGINS[options.type].minHeight}px`;
      }
    }

    const draggableHandle = options._container.querySelector('.ui-draggable-handle');
    if (draggableHandle) {
      draggableHandle.style.width = options._container.style.width;
      draggableHandle.style.height = options._container.style.height;
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
        /* jslint evil: true */
        const fn = new Function('options', options.scripts[key]);
        options.scripts._compiled[key] = function () {
          return fn.apply(fn, [{
            event: options,
          }]);
        };
      });
    }
  }

  return Popcorn.plugin('social', {
    manifest: {
      about: {
        name: 'Popcorn Social Plugin',
        version: '0.1',
        author: 'Eugenia Rakhmatova: @mstmustisnt',
        website: 'digistrats.com',
      },
      defaultOptions: FB_PLUGINS,
      options: {
        type: {
          elem: 'select',
          options: [
            'Like button',
            'Comments',
            'Page',
            'Embedded comments',
            'Embedded posts',
          ],
          values: ['fb-like', 'fb-comments', 'fb-page', 'fb-comment-embed', 'fb-post'],
          label: 'Plugin type',
          default: 'fb-like',
        },
        target: 'video-container',
        start: {
          elem: 'input',
          type: 'text',
          label: 'Start',
          units: 'seconds',
        },
        end: {
          elem: 'input',
          type: 'text',
          label: 'End',
          units: 'seconds',
        },
        // optional parameters:
        href: {
          elem: 'input',
          type: 'url',
          validation: urlRegex,
          label: 'URL',
        },
        'include-parent': {
          elem: 'input',
          type: 'checkbox',
          optional: true,
          label: 'Include parent comment',
        },
        width: {
          elem: 'input',
          type: 'number',
          label: 'Width',
          hidden: true,
          optional: true,
          units: '%',
        },
        height: {
          elem: 'input',
          type: 'number',
          label: 'Height',
          hidden: true,
          optional: true,
          units: '%',
        },
        editorWidth: {
          elem: 'input',
          type: 'number',
          label: 'Width',
          hidden: true,
          optional: true,
          units: 'px',
        },
        editorHeight: {
          elem: 'input',
          type: 'number',
          label: 'Height',
          hidden: true,
          optional: true,
          units: 'px',
        },
        zindex: {
          hidden: true,
        },
        top: {
          elem: 'input',
          type: 'number',
          label: 'Top',
          default: 0,
          hidden: true,
        },
        left: {
          elem: 'input',
          type: 'number',
          label: 'Left',
          default: 0,
          hidden: true,
        },
        scripts: {
          onStart: '',
          onEnd: '',
        },
      },
    },

    _setup(options) {
      const target = document.getElementById(options.target);
      let containerDiv;
      let videoContainerDiv;
      let offsetLeft;

      if (!options._container) {
        options._container = document.createElement('div');
        options._container.id = `facebookDiv-${Popcorn.guid()}`;
        options._container.classList.add('social-plugin-div');
        options._facebookDiv = document.createElement('div');
        options._container.appendChild(options._facebookDiv);
        options._container.style.display = 'none';
      }

      options.href = options.href || FB_PLUGINS[options.type].href;

      if (target) {
        target.appendChild(options._container);
        options._target = target;
      }


      setAttributes(options);
      options._container.style.position = 'absolute';
      options._container.style.top = options._container.style.top || (`${options.top}%`);
      options._container.style.zIndex = options.zindex;

      // facebook script requires a div named fb-root
      if (!document.getElementById('fb-root')) {
        const fbRoot = document.createElement('div');
        fbRoot.setAttribute('id', 'fb-root');
        document.body.appendChild(fbRoot);
      }

      if (!window.Butter) {
        containerDiv = document.getElementById('container');
        videoContainerDiv = containerDiv.querySelector('#video-container');
        offsetLeft = (options.left * videoContainerDiv.clientWidth) / 100;

        // in embed left spacing is set relatively #container
        options._container.style.left = `${offsetLeft + videoContainerDiv.offsetLeft}px`;
      } else {
        options._container.style.left = options._container.style.left || (`${options.left}%`);
      }

      options.toString = function () {
        if (options.type) {
          return FB_PLUGINS[options.type].title;
        }

        return 'Social Plugin';
      };

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
    _teardown(options) {
      const target = document.getElementById(options.target);

      if (target) {
        target.removeChild(options._container);
      }
    },
  });
});
