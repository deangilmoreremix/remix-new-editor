/* eslint-disable no-underscore-dangle,no-new-func,no-useless-escape */
// PLUGIN: IMAGE
import { draggableResizable } from '../../helpers';
import { addDeleteListener, removeDeleteListener } from '../../../mitt/emitter';
import { POPCORN_ELEMENT_TYPES, TOP, LEFT } from '../../../constants/popcorn';
// const interact = require('interactjs');
const { extendObservable } = require('mobx');

// const { consts } = require('../../../../lib/consts/consts');

// const { callToActionFeature } = consts;
// const { callToActionFeature } = {};

function isSafari() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('safari') !== -1) {
    return ua.indexOf('chrome') === -1;
  }
  return false;
}

((Popcorn) => {
  const APIKEY = '&api_key=b939e5bd8aa696db965888a31b2f1964';
  const flickrUrl = 'https://secure.flickr.com/services/';
  const searchPhotosCmd = `${flickrUrl}rest/?method=flickr.photos.search&extras=url_m&media=photos&safe_search=1`;
  const getPhotosetCmd = `${flickrUrl}rest/?method=flickr.photosets.getPhotos&extras=url_m&media=photos`;
  const getPhotoSizesCmd = `${flickrUrl}rest/?method=flickr.photos.getSizes`;
  const jsonBits = '&format=json&jsoncallback=flickr';
  const FLICKR_SINGLE_CHECK = 'flickr.com/photos/';
  const PER_PAGE_MAX = 100;
  const logoUrlMeta = document.querySelector('meta[property="logo"]');

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

  function getDefaultOptionValue(key) {
    const { options } = Popcorn.manifest[POPCORN_ELEMENT_TYPES.IMAGE];
    if (options && options[key]) {
      return options[key].default;
    }
    return null;
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

  function searchImagesFlickr(tags, count, userId, ready) {
    let uri = `${searchPhotosCmd + APIKEY}&page=1&per_page=${PER_PAGE_MAX}`;
    if (userId && typeof userId !== 'function') {
      uri += `&user_id=${userId}`;
    }
    if (tags) {
      uri += `&tags=${window.encodeURIComponent(tags)}`;
    }
    uri += jsonBits;
    Popcorn.getJSONP(uri, (data) => {
      const callback = ready || userId;

      callback(data, uri);
    });
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

  function getPhotoSet(photosetId, ready, pluginInstance) {
    let photoSplit;
    let ln;
    let url;
    let i;

    /* Allow for a direct gallery URL to be passed or just a gallery ID. This will accept:
     *
     * http://www.flickr.com/photos/etherworks/sets/72157630563520740/
     * or
     * 72157630563520740
     */
    if (Number.isNaN(photosetId)) {
      if (photosetId.indexOf('flickr.com') === -1) {
        pluginInstance.emit('invalid-flickr-image');
        return;
      }

      photoSplit = photosetId.split('/');

      // Can't always look for the ID in the same spot depending if the user includes the
      // last slash
      for (i = 0, ln = photoSplit.length; i < ln; i += 1) {
        url = photoSplit[i];
        if (!Number.isNaN(url) && url !== '') {
          photosetId = url;
          break;
        }
      }
    }

    const uri = `${getPhotosetCmd}&photoset_id=${photosetId}&per_page=${PER_PAGE_MAX}${APIKEY}${jsonBits}`;
    Popcorn.getJSONP(uri, (data) => {
      ready(data, uri);
    });
  }

  function calculateInOutTimes(start, duration, count) {
    const inArr = [];
    let i = 0;
    let last = start;
    const interval = duration / count;

    while (i < count) {
      inArr.push({
        in: last = Math.round((start + (interval * (i += 1))) * 100) / 100,
        out: i < count ? Math.round((last + interval) * 100) / 100 : start + duration,
      });
    }
    return inArr;
  }

  function validateDimension(value, fallback) {
    if (typeof value === 'number') {
      return value;
    }
    return fallback;
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

  Popcorn.plugin('image', {

    _setup(options) {
      const _target = Popcorn.dom.find(options.target);
      let _container;
      let _flickrCallback;
      let _link;
      let _image;
      let linkUrlSpan;
      const _this = this;

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

        const linkMarkerIcon = document.createElement('span');
        linkMarkerIcon.classList.add('fa');
        linkMarkerIcon.classList.add('fa-link');
        linkMarkerIcon.setAttribute('title', 'This input supports URLs.');
        _urlContainer.appendChild(linkMarkerIcon);

        // const { currentUser } = options._context;
        // if (currentUser && currentUser.features.clickToPhoneCall
        //   && currentUser.features.clickToPhoneCall.state === 'enabled') {
        //   const phoneMarkerIcon = document.createElement('span');
        //   phoneMarkerIcon.classList.add('fa');
        //   phoneMarkerIcon.classList.add('fa-phone');
        //   phoneMarkerIcon.setAttribute('title', 'This input supports phone numbers.');
        //   _urlContainer.appendChild(phoneMarkerIcon);
        // }

        linkUrlSpan = document.createElement('span');
        linkUrlSpan.classList.add('link-url-span');
        _urlContainer.appendChild(linkUrlSpan);

        _urlContainer.addEventListener('click', catchCaretCharacterOffsetWithin(options, 'linkSrc'));
        linkUrlSpan.setAttribute('contenteditable', '');
        linkUrlSpan.addEventListener('input', (event) => {
          options.linkSrc = unwrapTokens(event.target.innerHTML);
          options._context.emit('elementUpdated', {
            type: 'image',
            element: options,
            options: {
              linkSrc: options.linkSrc,
            },
          });

          const caretPositionShifting = options.caretOffsets.linkSrc.length
            - prettyPrintTokens(
              event.target.innerText.substr(0, options.caretOffsets.linkSrc),
            ).length;
          if (caretPositionShifting > 0) {
            event.target.innerHTML = wrapTokens(options.linkSrc);
            options.caretOffsets.linkSrc -= caretPositionShifting;
            const selection = window.getSelection();
            if (selection) {
              let offset = options.caretOffsets.linkSrc;
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
        linkUrlSpan.addEventListener('paste', (e) => {
          e.preventDefault();
          const sanitizingElem = document.createElement('DIV');
          sanitizingElem.innerHTML = unwrapTokens((e.clipboardData || window.clipboardData).getData('text/plain'));
          const pasteString = sanitizingElem.textContent || sanitizingElem.innerText || '';
          document.execCommand('insertHTML', false, wrapTokens(pasteString));
        });
        if (options.linkSrc) {
          linkUrlSpan.innerHTML = wrapTokens(options.linkSrc);
          if (_container && !_container.querySelector('.url-container')) {
            _container.appendChild(_urlContainer);
          }
        }

        options.link = _link;
        options.image = _image;
        options.urlContainer = _urlContainer;
      }

      options._target = _target;
      _container = document.createElement('div');
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

        // const { currentUser } = options._context;
        // if (!options.linkSrc) {
        //   linkUrlSpan.innerHTML =
        // wrapTokens(callToActionFeature[currentUser.features.clickToPhoneCall.state]);
        // }
        _this.emit('elementSelected', {
          element: options,
        });
      });

      removeDeleteListener(_container, options.id);
      addDeleteListener(_container, options.id);

      _container.classList.add('popcorn-image');
      _container.setAttribute('tabIndex', -1);
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
          if (options.src.indexOf(FLICKR_SINGLE_CHECK) > -1) {
            let url = options.src;
            let ln;
            let photoId;
            let i;

            const urlSplit = url.split('/');
            const uri = `${getPhotoSizesCmd + APIKEY}&photo_id=${photoId}${jsonBits}`;

            for (i = 0, ln = urlSplit.length; i < ln; i += 1) {
              url = urlSplit[i];
              if (!Number.isNaN(url) && url !== '') {
                photoId = url;
                break;
              }
            }

            const _flickrStaticImage = (data) => {
              if (data.stat === 'ok') {
                // Unfortunately not all requests contain an "Original" size option
                // so I'm always taking the second last one. This has it's upsides and downsides
                _link = createImageDiv(data.sizes.size[data.sizes.size.length - 2].source);
                setupImageDiv();
              }
            };

            Popcorn.getJSONP(uri, _flickrStaticImage);
          } else if (options.dropData && options.dropData.files && options.dropData.files[0]) {
            options.src = undefined;
          } else {
            _link = createImageDiv(options, options.src);
            setupImageDiv();
          }
        } else {
          let _inOuts = [];
          let _lastVisible;
          const _tagRefs = [];

          options._updateImage = () => {
            let io;
            let ref;
            const currTime = _this.currentTime();

            for (let i = _tagRefs.length - 1; i >= 0; i -= 1) {
              io = _inOuts[i];
              ref = _tagRefs[i];
              if (io && currTime >= io.in && currTime < io.out && ref.classList.contains('image-plugin-hidden')) {
                if (_lastVisible) {
                  _lastVisible.classList.add('image-plugin-hidden');
                }
                ref.classList.remove('image-plugin-hidden');
                _lastVisible = ref;
                break;
              }
            }
          };

          _flickrCallback = (data, url) => {
            const _collection = (data.photos || data.photoset);
            let _url;
            let item;

            if (!_collection) {
              return;
            }

            const _photos = _collection.photo;

            if (!_photos) {
              return;
            }

            for (let i = 0; i < _photos.length; i += 1) {
              if (options.count > _tagRefs.length) {
                item = _photos[i];
                _url = (item.media && item.media.m) || window.unescape(item.url_m);
                _link = createImageDiv(_url, _url);
                _link.classList.add('image-plugin-hidden');
                _container.insertBefore(_link, _container.children[i]);
                _tagRefs.push(_link);
              } else {
                break;
              }
            }

            if (_tagRefs.length < options.count
              && _collection.page !== _collection.pages
              && _photos.length === PER_PAGE_MAX) {
              url = url.replace(/\&per\_page\=[0-9]+/, '');
              url += `&per_page=${_collection.page}${1}`;

              Popcorn.getJSONP(url, (urlData) => {
                _flickrCallback(urlData, url);
              });
            } else {
              _inOuts = calculateInOutTimes(
                options.start, options.end - options.start, _tagRefs.length,
              );

              if (!_tagRefs.length) {
                _this.emit('popcorn-image-failed-retrieve');
                return;
              }

              if (options.count !== _tagRefs.length) {
                options.count = _tagRefs.length;
                // Used to sync back the new count data with Butter Events
                _this.emit('popcorn-image-count-update', options.count);
              }

              // Check if should be currently visible
              options._updateImage();

              //  Check if should be updating
              if (_this.currentTime() >= options.start && _this.currentTime() <= options.end) {
                _this.on('timeupdate', options._updateImage);
              }
            }
          };

          if (options.tags) {
            searchImagesFlickr(options.tags, options.count || 10, _flickrCallback);
          } else if (options.photosetId) {
            getPhotoSet(options.photosetId, _flickrCallback, _this);
          }
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
          } else if (options.tags) {
            return options.tags;
          } else if (options.photosetId) {
            return options.photosetId;
          }

          return 'Image Plugin';
        };
      }

      options.link.style.borderRadius = `${options.cornerRadius || 0}%`;
      if (options.background) {
        options.link.style.background = options.backgroundColor;
      }

      draggableResizable(options, { draggable: true, resizable: true });
      buildScripts(options);
      extendObservable(options, {
        src: options.src,
        linkSrc: options.linkSrc,
        innerTop: options.innerTop,
        innerLeft: options.innerLeft,
        innerWidth: options.innerWidth,
        background: options.background,
        innerHeight: options.innerHeight,
        cornerRadius: options.cornerRadius,
        backgroundColor: options.backgroundColor,
        callNotifyAddress: options.callNotifyAddress,
        top: +options.top || getDefaultOptionValue(TOP),
        left: +options.left || getDefaultOptionValue(LEFT),
      });

      options._activeHandle = {
        type: 'linkSrc',
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
          const safariHack = () => {
            container.style.display = 'none';
            container.style.display = '';
          };

          if (['popcorn-fade', 'popcorn-slide-up', 'popcorn-slide-down'].indexOf(options.transition) === -1) {
            safariHack();
          } else {
            setTimeout(safariHack, 430);
          }
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
            const safariHack = () => {
              container.style.display = 'none';
              container.style.display = '';
            };

            if (['popcorn-fade', 'popcorn-slide-up', 'popcorn-slide-down'].indexOf(options.transition) === -1) {
              safariHack();
            } else {
              setTimeout(safariHack, 430);
            }
          }

          buildScripts(options);
          if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
            options.scripts._compiled.onStart();
          }
        }, 430);
      }
    },

    _update(trackEvent, options) {
      if (options.start && options.start !== trackEvent.start) {
        trackEvent.start = options.start;
      }
      if (options.end && options.end !== trackEvent.end) {
        trackEvent.end = options.end;
      }

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

      if (options.title !== undefined && options.title !== trackEvent.title) {
        trackEvent.title = options.title;
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

      if (options.callNotifyAddress !== undefined
        && options.callNotifyAddress !== trackEvent.callNotifyAddress) {
        trackEvent.callNotifyAddress = options.callNotifyAddress;
      }

      if ((options.src !== undefined && options.src !== trackEvent.src)
        || (options.linkSrc !== undefined && options.linkSrc !== trackEvent.linkSrc)) {
        if (options.src !== undefined) {
          trackEvent.src = options.src;
        }
        if (options.linkSrc !== undefined) {
          trackEvent.linkSrc = options.linkSrc;
        }

        const imageDiv = trackEvent.link.querySelector('.image-plugin-img');
        imageDiv.style.backgroundImage = `src( "${trackEvent.src}" )`;

        if (trackEvent.linkSrc) {
          const linkUrlSpan = trackEvent.urlContainer.querySelector('.link-url-span');
          linkUrlSpan.innerHTML = wrapTokens(trackEvent.linkSrc);
        }
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

      draggableResizable(trackEvent, { draggable: true, resizable: true });
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
          label: 'Source URL',
          default: logoUrlMeta ? logoUrlMeta.content : '',
          FLICKR_SINGLE_CHECK,
        },
        linkSrc: {
          elem: 'input',
          type: 'url',
          label: 'Link URL',
        },
        callNotifyAddress: {
          elem: 'input',
          type: 'text',
          label: 'Email to notify about call attempt',
        },
        tags: {
          elem: 'input',
          type: 'text',
          label: 'Flickr: Tags',
          optional: true,
          default: '',
        },
        photosetId: {
          elem: 'input',
          type: 'text',
          label: 'Flickr: Photoset Id',
          optional: true,
          default: '',
        },
        count: {
          elem: 'input',
          type: 'number',
          label: 'Flickr: Count',
          optional: true,
          default: 3,
          MAX_COUNT: 20,
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
          options: ['None', 'Pop', 'Slide Up', 'Slide Down', 'Fade', 'Fade In', 'Pan & Zoom', 'Fade In Up'],
          values: ['popcorn-none', 'popcorn-pop', 'popcorn-slide-up', 'popcorn-slide-down', 'popcorn-fade',
            'popcorn-fade-in', 'popcorn-pan-zoom', 'popcorn-fade-in-up'],
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
