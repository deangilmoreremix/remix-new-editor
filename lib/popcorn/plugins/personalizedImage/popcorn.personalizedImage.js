/* eslint-disable no-underscore-dangle,no-new-func,no-useless-escape */
// PLUGIN: PERSONALIZED IMAGE

// const interact = require('interactjs');
import emitter from "../../../mitt/emitter";

const { extendObservable } = require('mobx');

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

  const TOKEN_HELPER_CLASSES = {
    d: 'token-default',
    default: 'token-default',
    up: 'token-uppercase',
    uppercase: 'token-uppercase',
  };
  const OPEN_PERSONALIZATION_TAG = '<span class="personalized-token" contenteditable="false">';
  const CLOSE_PERSONALIZATION_TAG = '</span>';

  function catchCaretCharacterOffsetWithin(options, field) {
    return ({ target: element }) => {
      let caretOffset = 0;
      const doc = element.ownerDocument || element.document;
      const win = doc.defaultView || doc.parentWindow;
      let sel;
      if (typeof win.getSelection !== 'undefined') {
        sel = win.getSelection();
        if (sel.rangeCount > 0) {
          const range = win.getSelection().getRangeAt(0);
          const preCaretRange = range.cloneRange();
          preCaretRange.selectNodeContents(element);
          preCaretRange.setEnd(range.endContainer, range.endOffset);
          caretOffset = preCaretRange.toString().length;
        }
      } else if (doc.selection && doc.selection.type !== 'Control') {
        sel = doc.selection;
        const textRange = sel.createRange();
        const preCaretTextRange = doc.body.createTextRange();
        preCaretTextRange.moveToElementText(element);
        preCaretTextRange.setEndPoint('EndToEnd', textRange);
        caretOffset = preCaretTextRange.text.length;
      }
      options.caretOffsets = options.caretOffsets || {};
      options._activeHandle = {
        type: field,
        target: element,
      };
      if (element.class === 'personalized-token') {
        let offset = 0;
        for (let i = 0;
          i < element.parentNode.childNodes.length
             && element.parentNode.childNodes[i] !== element;
          i += 1) {
          offset += (
            element.parentNode.childNodes[i].innerText
            || element.parentNode.childNodes[i].textContent
          ).length;
        }
        offset += (element.innerText || element.textContent).length;
        caretOffset = offset;
      }
      options.caretOffsets[field] = caretOffset;
    };
  }

  function validateDimension(value, fallback) {
    if (typeof value === 'number') {
      return value;
    }
    return fallback;
  }

  function prettyPrintTokens(string) {
    const tokenRegex = /{{(up \w*|d \w* ("[^{}]*"|'[^{}]*')|"\w*"|\w*)}}/gm;
    return string.replace(tokenRegex, (match) => {
      match = match.replace(/({{|}})/gm, '');
      let tokenName;
      if (match.split(' ').length > 1) {
        [, tokenName] = match.split(' ');
      } else {
        tokenName = match;
      }
      return tokenName;
    });
  }

  function wrapTokens(string) {
    const tokenRegex = /{{(up \w*|d \w* ("[^{}]*"|'[^{}]*')|"\w*"|\w*)}}/gm;
    return string.replace(tokenRegex, (match) => {
      match = match.replace(/({{|}})/gm, '');
      let result = OPEN_PERSONALIZATION_TAG;
      if (match.split(' ').length > 1) {
        const [helper, tokenName, ...params] = match.split(' ');
        result += `<span class="${TOKEN_HELPER_CLASSES[helper]}" data-parameter="${params.join(JSON.stringify(params))}"></span>`;
        result += tokenName;
      } else {
        result += '<span class="token-none" data-parameter=""></span>';
        result += match;
      }
      result += CLOSE_PERSONALIZATION_TAG;
      return result;
    });
  }

  function unwrapTokens(string) {
    const tokenRegexPattern = `${OPEN_PERSONALIZATION_TAG}(<span class="(token-default|token-uppercase|token-none)" data-parameter="([^="<>]*)"></span>)?([^{}="<>]*)${CLOSE_PERSONALIZATION_TAG}`;
    const smartTokenRegex = new RegExp(tokenRegexPattern, 'gm');
    return string.replace(smartTokenRegex, (match) => {
      // to reset regexp pointer, let's use new regexp instance
      const [, , helper, params, token] = new RegExp(tokenRegexPattern, 'gm').exec(match);
      if (helper && helper !== 'token-none') {
        const [tokenHelper] = Object
          .entries(TOKEN_HELPER_CLASSES)
          .find(([, value]) => value === helper);
        return `{{${tokenHelper} ${token}${(params && params.length > 0) ? ` ${params}` : ''}}}`;
      } else {
        return `{{${token}}}`;
      }
    });
  }

  function draggableResizable(element) {
    function setResizableHandles() {
      const positions = [
        { top: '-4px', left: '-4px' },
        { top: '-4px', left: '48%' },
        { top: '-4px', right: '-4px' },
        { top: '48%', left: '-4px' },
        { top: '48%', right: '-4px' },
        { bottom: '-4px', left: '-4px' },
        { bottom: '-4px', left: '48%' },
        { bottom: '-4px', right: '-4px' },
      ];
      element._container.querySelectorAll('.resize-handle').forEach((child) => {
        child.parentNode.removeChild(child);
      });
      positions.forEach((position) => {
        const handle = document.createElement('div');
        handle.classList.add('resize-handle');
        Object.keys(position).forEach((positionKey) => {
          handle.style[positionKey] = position[positionKey];
        });
        element._container.appendChild(handle);
      });
    }

    // const dragMoveListener = (event) => {
    //   const { target } = event;
    //   const x = (
    //     parseFloat(target.getAttribute('data-x')) || (element.left / 100)
    // * element._container.parentNode.offsetWidth
    //   )
    //     + (event.deltaRect ? event.deltaRect.left : event.dx);
    //   const y = (
    //     parseFloat(target.getAttribute('data-y')) || (element.top / 100)
    // * element._container.parentNode.offsetHeight
    //   )
    //     + (event.deltaRect ? event.deltaRect.top : event.dy);
    //
    //   const relativeTop = (
    //     y / element._container.parentNode.offsetHeight
    //   ) * 100;
    //   const relativeLeft = (
    //     x / element._container.parentNode.offsetWidth
    //   ) * 100;
    //   element.top = relativeTop;
    //   element.left = relativeLeft;
    //   element._container.style.top = `${relativeTop}%`;
    //   element._container.style.left = `${relativeLeft}%`;
    //   if (event.rect) {
    //     const relativeHeight = (
    //       event.rect.height / element._container.parentNode.offsetHeight
    //     ) * 100;
    //     const relativeWidth = (
    //       event.rect.width / element._container.parentNode.offsetWidth
    //     ) * 100;
    //     element.width = relativeWidth;
    //     element.height = relativeHeight;
    //     element._container.style.width = `${relativeWidth}%`;
    //     element._container.style.height = `${relativeHeight}%`;
    //   }
    //
    //   target.setAttribute('data-x', x);
    //   target.setAttribute('data-y', y);
    //   if (['dragend', 'resizeend'].indexOf(event.type) !== -1) {
    //     element._context.emit('elementUpdated', {
    //       type: 'personalizedImage',
    //       element,
    //       options: {
    //         top: element.top,
    //         left: element.left,
    //         width: element.width,
    //         height: element.height,
    //       },
    //     });
    //   }
    // };

    // interact(element._container)
    //   .draggable({
    //     onmove: dragMoveListener,
    //     onend: dragMoveListener,
    //     restrict: {
    //       restriction: 'parent',
    //       elementRect: { top: 0, left: 0, bottom: 1, right: 1 },
    //     },
    //   })
    //   .resizable({
    //     // resize from all edges and corners
    //     edges: { left: true, right: true, bottom: true, top: true },
    //
    //     // keep the edges inside the parent
    //     restrictEdges: {
    //       outer: 'parent',
    //       endOnly: true,
    //     },
    //     // minimum size
    //     restrictSize: {
    //       min: { width: 30, height: 30 },
    //     },
    //     inertia: true,
    //     onmove: dragMoveListener,
    //     onend: dragMoveListener,
    //   });
    setResizableHandles();
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

  function createImageDiv(element, imageUrl) {
    const link = document.createElement('div');
    const imageDiv = document.createElement('div');
    link.classList.add('image-plugin-link');
    imageDiv.classList.add('image-plugin-img');

    imageDiv.style.backgroundImage = `url( "${imageUrl}" )`;
    link.appendChild(imageDiv);

    return link;
  }

  Popcorn.plugin('personalizedImage', {

    _setup(options) {
      const _this = this;
      let _link;
      let _image;

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

        const _urlContainer = document.createElement('span');
        _urlContainer.classList.add('url-container');
        _urlContainer.addEventListener('click', catchCaretCharacterOffsetWithin(options, 'src'));
        _urlContainer.addEventListener('keyup', catchCaretCharacterOffsetWithin(options, 'src'));
        _urlContainer.addEventListener('input', catchCaretCharacterOffsetWithin(options, 'src'));
        _urlContainer.setAttribute('contenteditable', '');
        _urlContainer.addEventListener('input', (event) => {
          options.src = unwrapTokens(event.target.innerHTML);
          options._context.emit('elementUpdated', {
            type: 'personalizedImage',
            element: options,
            options: {
              src: options.src,
            },
          });

          const caretPositionShifting = options.caretOffsets.src.length
            - prettyPrintTokens(
              event.target.innerText.substr(0, options.caretOffsets.src),
            ).length;
          if (caretPositionShifting > 0) {
            event.target.innerHTML = wrapTokens(options.src);
            options.caretOffsets.src -= caretPositionShifting;
            const selection = window.getSelection();
            if (selection) {
              let offset = options.caretOffsets.src;
              let nodeIndex;
              for (nodeIndex = 0;
                nodeIndex < event.target.childNodes.length
                   && offset >= (
                     event.target.childNodes[nodeIndex].innerText
                     || event.target.childNodes[nodeIndex].textContent
                   ).length;
                nodeIndex += 1) {
                offset -= (
                  event.target.childNodes[nodeIndex].innerText
                  || event.target.childNodes[nodeIndex].textContent
                ).length;
              }
              selection.getRangeAt(0).setStart(event.target.childNodes[nodeIndex], offset);
            }
          }
        });
        _urlContainer.addEventListener('paste', (e) => {
          e.preventDefault();
          const sanitizingElem = document.createElement('DIV');
          sanitizingElem.innerHTML = unwrapTokens((e.clipboardData || window.clipboardData).getData('text/plain'));
          const pasteString = sanitizingElem.textContent || sanitizingElem.innerText || '';
          document.execCommand('insertHTML', false, wrapTokens(pasteString));
        });
        _urlContainer.innerHTML = wrapTokens(options.src);
        _container.appendChild(_urlContainer);

        options.link = _link;
        options.image = _image;
        options.urlContainer = _urlContainer;
      }

      options._target = _target;
      options._container = _container;
      options._context = _this;

      _this.on('elementSelected', (event) => {
        const { element } = event;
        if (options._container) {
          options._container.classList[element === options ? 'add' : 'remove']('active');
        }
      });

      _container.addEventListener('click', (event) => {
        event.stopPropagation();
        _this.emit('elementSelected', {
          element: options,
        });
      });

      _container.addEventListener('keydown', e => {
        if (e.key === 'Delete') {
          emitter.emit('delete', options.id);
        }
      });

      _container.classList.add('personalized-image');
      _container.style.width = `${validateDimension(options.width, '100')}%`;
      _container.style.height = `${validateDimension(options.height, '100')}%`;
      _container.style.top = `${validateDimension(options.top, '0')}%`;
      _container.style.left = `${validateDimension(options.left, '0')}%`;
      _container.style.zIndex = +options.zindex;
      _container.classList.add(options.transition);
      _container.classList.add('off');

      const rotation = options.rotation || 0;
      _container.style.transform = `rotate(${rotation}deg)`;
      _container.style['-webkit-transform'] = `rotate(${rotation}deg)`;
      _container.style['-moz-transform'] = `rotate(${rotation}deg)`;
      _container.style['-ms-transform'] = `rotate(${rotation}deg)`;

      if (_target) {
        _target.appendChild(_container);

        if (options.src) {
          _link = createImageDiv(options, PLACEHOLDER_URL);
          setupImageDiv();
        }

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

      draggableResizable(options);
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
        if (options.linkSrc !== undefined) {
          trackEvent.linkSrc = options.linkSrc;
        }
        trackEvent._container.removeChild(trackEvent._container.querySelector('.image-plugin-link'));
        const _link = createImageDiv(trackEvent, PLACEHOLDER_URL);
        trackEvent._container.appendChild(_link);
        const _image = _link.querySelector('.image-plugin-img');
        trackEvent.link = _link;
        trackEvent.image = _image;
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
        src: {
          elem: 'input',
          type: 'url',
          label: 'Param Name',
          default: '{{IMAGE}}',
        },
        linkSrc: {
          elem: 'input',
          type: 'url',
          label: 'Link URL',
          validation: urlRegex,
        },
        width: {
          elem: 'input',
          type: 'number',
          label: 'Width',
          default: 100,
          units: '%',
          hidden: true,
        },
        cornerRadius: {
          elem: 'input',
          type: 'number',
          label: 'Corner Radius',
          default: 0,
          units: '%',
          hidden: true,
        },
        height: {
          elem: 'input',
          type: 'number',
          label: 'Height',
          default: 100,
          units: '%',
          hidden: true,
        },
        top: {
          elem: 'input',
          type: 'number',
          label: 'Top',
          default: 0,
          units: '%',
          hidden: true,
        },
        left: {
          elem: 'input',
          type: 'number',
          label: 'Left',
          default: 0,
          units: '%',
          hidden: true,
        },
        innerTop: {
          elem: 'input',
          type: 'number',
          default: 0,
          units: '%',
          hidden: true,
        },
        innerLeft: {
          elem: 'input',
          type: 'number',
          default: 0,
          units: '%',
          hidden: true,
        },
        innerWidth: {
          elem: 'input',
          type: 'number',
          default: 0,
          units: '%',
          hidden: true,
        },
        innerHeight: {
          elem: 'input',
          type: 'number',
          default: 0,
          units: '%',
          hidden: true,
        },
        background: {
          elem: 'input',
          type: 'checkbox',
          label: 'Background',
          default: false,
          hidden: true,
        },
        backgroundColor: {
          elem: 'input',
          type: 'color',
          label: 'Background color',
          hidden: true,
        },
        title: {
          elem: 'input',
          type: 'text',
          label: 'Image Title',
          default: '',
        },
        transition: {
          elem: 'select',
          options: ['None', 'Pop', 'Slide Up', 'Slide Down', 'Fade', 'Fade In', 'Fade In Up'],
          values: ['popcorn-none', 'popcorn-pop', 'popcorn-slide-up', 'popcorn-slide-down', 'popcorn-fade', 'popcorn-fade-in', 'popcorn-fade-in-up'],
          label: 'Transition',
          default: 'popcorn-fade',
        },
        rotation: {
          elem: 'input',
          type: 'number',
          label: 'Rotation',
          default: 0,
          units: 'degrees',
        },
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
        zindex: {
          hidden: true,
        },
        scripts: {
          onStart: '',
          onEnd: '',
        },
      },
    },
  });
})(window.Popcorn);
