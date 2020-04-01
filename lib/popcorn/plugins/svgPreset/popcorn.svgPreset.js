// TODO: Refactor this to fit our needs!
/* eslint-disable no-underscore-dangle,no-new-func */
// PLUGIN: text

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

((Popcorn, jQuery) => {
  /**
   * text Popcorn plug-in
   * Based on popcorn.text.js by @humph
   * @param {Object} options
   *
   * Example:

   * */

  const DEFAULT_FONT_COLOR = '#000000';
  const DEFAULT_SHADOW_COLOR = '#444444';
  const DEFAULT_STROKE_COLOR = '#000000';
  const DEFAULT_BACKGROUND_COLOR = '#888888';

  const TOKEN_HELPER_CLASSES = {
    d: 'token-default',
    default: 'token-default',
    up: 'token-uppercase',
    uppercase: 'token-uppercase',
  };
  const OPEN_PERSONALIZATION_TAG = '<span class="personalized-token" contenteditable="false">';
  const CLOSE_PERSONALIZATION_TAG = '</span>';

  function getAbsoluteStyleDimension(element, style) {
    return window.getComputedStyle(element)[style];
  }

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
      options.caretOffsets[field] = caretOffset;
    };
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
        result += `<span class="${TOKEN_HELPER_CLASSES[helper]}" data-parameter="${encodeURIComponent(JSON.stringify(params.map(param => param.substr(1, param.length - 2))))}"></span>`;
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
    const tokenRegexPattern = `${OPEN_PERSONALIZATION_TAG}(<span class="(token-default|token-uppercase|token-none)" data-parameter="([^="<>]*)"( style="[^="<>]*")?></span>)?([^{}="<>]*)${CLOSE_PERSONALIZATION_TAG}`;
    const smartTokenRegex = new RegExp(tokenRegexPattern, 'gm');
    return string.replace(smartTokenRegex, (match) => {
      // to reset regexp pointer, let's use new regexp instance
      const [, , helper, params, , token] = new RegExp(tokenRegexPattern, 'gm').exec(match);
      if (helper && helper !== 'token-none') {
        const [tokenHelper] = Object
          .entries(TOKEN_HELPER_CLASSES)
          .find(([, value]) => value === helper);
        const parsedParams = params && JSON.parse(decodeURIComponent(params)).map(elem => `"${elem}"`);
        return `{{${tokenHelper} ${token}${(parsedParams && parsedParams.length > 0) ? ` ${parsedParams.join(' ')}` : ''}}}`;
      } else {
        return `{{${token}}}`;
      }
    });
  }

  // function updateDraggableResizable(element, options, textfill) {
  function updateDraggableResizable(element) {
    function setResizableHandles() {
      const positions = element.fontDecorations.responsive ? [
        { top: '-4px', left: '-4px' },
        { top: '-4px', left: '48%' },
        { top: '-4px', right: '-4px' },
        { top: '48%', left: '-4px' },
        { top: '48%', right: '-4px' },
        { bottom: '-4px', left: '-4px' },
        { bottom: '-4px', left: '48%' },
        { bottom: '-4px', right: '-4px' },
      ] : [
        { top: '48%', left: '-4px' },
        { top: '48%', right: '-4px' },
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
    //   element.position = 'custom';
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
    //     element._container.style.width = `${relativeWidth}%`;
    //     if (element.fontDecorations.responsive) {
    //       element.height = relativeHeight;
    //       element._container.style.height = `${relativeHeight}%`;
    //     }
    //     element._container.querySelector('.text-inner-div').style['overflow-y'] = 'auto';
    //   } else if (!element.fontDecorations.responsive) {
    //     element._container.querySelector('.text-inner-div').style['overflow-y'] = 'visible';
    //     element._container.style.maxHeight = `${100 - element.top}%`;
    //   }
    //
    //   target.setAttribute('data-x', x);
    //   target.setAttribute('data-y', y);
    //   if (['dragend', 'resizeend'].indexOf(event.type) !== -1) {
    //     element._context.emit('elementUpdated', {
    //       type: 'text',
    //       element,
    //       options: {
    //         top: element.top,
    //         left: element.left,
    //         width: element.width,
    //         height: element.height,
    //         position: 'custom',
    //       },
    //     });
    //     if (element.fontDecorations.responsive && textfill) {
    //       textfill();
    //     }
    //   }
    // };

    if (!element._interact) {
      // element._interact = interact(element._container);
    }
    // element._interact
    //   .draggable(options.draggable ? {
    //     onmove: dragMoveListener,
    //     onend: dragMoveListener,
    //     restrict: {
    //       restriction: 'parent',
    //       elementRect: { top: 0, left: 0, bottom: 1, right: 1 },
    //     },
    //   } : false)
    //   .resizable(options.resizable ? {
    //     // resize from all edges and corners
    //     edges: {
    //       left: true,
    //       right: true,
    //       bottom: element.fontDecorations.responsive,
    //       top: element.fontDecorations.responsive,
    //     },
    //
    //     // keep the edges inside the parent
    //     restrictEdges: {
    //       outer: 'parent',
    //       endOnly: true,
    //     },
    //     // minimum size
    //     restrictSize: {
    //       min: { width: 45, height: 45 },
    //     },
    //     inertia: true,
    //     onmove: dragMoveListener,
    //     onend: dragMoveListener,
    //   } : false);
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
        options.scripts._compiled[key] = () => (fn.apply(fn, [{
          event: options,
        }]));
      });
    }
  }

  Popcorn.plugin('text', {

    manifest: {
      about: {
        name: 'Popcorn text Plugin',
        version: '0.1',
        author: '@k88hudson, @mjschranz',
      },
      options: {
        text: {
          elem: 'textarea',
          label: 'Text',
          default: 'Video Editor',
        },
        linkUrl: {
          elem: 'input',
          type: 'text',
          label: 'Link URL',
        },
        callNotifyAddress: {
          elem: 'input',
          type: 'text',
          label: 'Email to notify about call attempt',
        },
        linkTarget: {
          elem: 'select',
          options: ['New Tab', 'Current Tab'],
          values: ['_blank', '_parent'],
          label: 'Open Link In',
          default: '_blank',
        },
        position: {
          elem: 'select',
          options: ['Custom', 'Middle', 'Bottom', 'Top'],
          values: ['custom', 'middle', 'bottom', 'top'],
          label: 'Text Position',
          default: 'custom',
        },
        alignment: {
          elem: 'select',
          options: ['Center', 'Left', 'Right'],
          values: ['center', 'left', 'right'],
          label: 'Text Alignment',
          default: 'center',
        },
        start: {
          elem: 'input',
          type: 'text',
          label: 'In',
          group: 'advanced',
          units: 'seconds',
        },
        end: {
          elem: 'input',
          type: 'text',
          label: 'Out',
          group: 'advanced',
          units: 'seconds',
        },
        transition: {
          elem: 'select',
          options: ['None',
            'Pop',
            'Fade',
            'Fade In',
            'Fade In Up',
            'Slide Up',
            'Slide Down',
            'Swivel In (Y-axis)',
            'Swivel In (X-axis)',
            'Typing Effect',
            'Blur (White)',
            'Wobble Vertical',
            'Wobble Horizontal',
            'Wobble Diagonal',
            'Pulse (Looped)',
            'Push',
            'Bob',
            'Buzz',
            'Buzz out',
            'Stroke Pulse (Looped)',
            'Flicker',
            'Type Blink',
          ],

          values: ['popcorn-none',
            'popcorn-pop',
            'popcorn-fade',
            'popcorn-fade-in',
            'popcorn-fade-in-up',
            'popcorn-slide-up',
            'popcorn-slide-down',
            'popcorn-swivel-y',
            'popcorn-swivel-x',
            'popcorn-typing',
            'popcorn-blur-w',
            'popcorn-wobble-vertical',
            'popcorn-wobble-horizontal',
            'popcorn-wobble-diagonal',
            'popcorn-pulse',
            'popcorn-push',
            'popcorn-bob',
            'popcorn-buzz',
            'popcorn-buzz-out',
            'popcorn-stroke-pulse',
            'animate-flicker',
            'popcorn-type-blink',
          ],

          label: 'Transition',
          default: 'popcorn-fade-in',
        },
        rotation: {
          elem: 'input',
          type: 'number',
          label: 'Rotation',
          default: 0,
          units: 'degrees',
        },
        fontFamily: {
          elem: 'select',
          label: 'Font',
          styleClass: '',
          googleFonts: true,
          group: 'advanced',
          default: 'Anton',
        },
        fontSize: {
          elem: 'input',
          type: 'number',
          label: 'Font Size',
          default: 8,
          units: '%',
          group: 'advanced',
        },
        fontColor: {
          elem: 'input',
          type: 'color',
          label: 'Font color',
          default: DEFAULT_FONT_COLOR,
          group: 'advanced',
        },
        shadow: {
          elem: 'input',
          type: 'checkbox',
          label: 'Shadow',
          default: false,
          group: 'advanced',
        },
        shadowColor: {
          elem: 'input',
          type: 'color',
          label: 'Shadow colour',
          default: DEFAULT_SHADOW_COLOR,
          group: 'advanced',
        },
        background: {
          elem: 'input',
          type: 'checkbox',
          label: 'Background',
          default: false,
          group: 'advanced',
        },
        backgroundColor: {
          elem: 'input',
          type: 'color',
          label: 'Background color',
          default: DEFAULT_BACKGROUND_COLOR,
          group: 'advanced',
        },
        stroke: {
          elem: 'input',
          type: 'checkbox',
          label: 'Stroke',
          default: false,
          group: 'advanced',
        },
        strokeColor: {
          elem: 'input',
          type: 'color',
          label: 'Stroke color',
          default: DEFAULT_STROKE_COLOR,
          group: 'advanced',
        },
        fontDecorations: {
          elem: 'checkbox-group',
          labels: { bold: 'Bold', italics: 'Italics', responsive: 'Scale To Fit' },
          default: { bold: false, italics: false, responsive: false },
          group: 'advanced',
        },
        left: {
          elem: 'input',
          type: 'number',
          label: 'Left',
          units: '%',
          default: 25,
          hidden: true,
        },
        top: {
          elem: 'input',
          type: 'number',
          label: 'Top',
          units: '%',
          default: 0,
          hidden: true,
        },
        width: {
          elem: 'input',
          type: 'number',
          units: '%',
          label: 'Width',
          default: 50,
          hidden: true,
        },
        height: {
          elem: 'input',
          type: 'number',
          units: '%',
          label: 'Height',
          default: 10,
          hidden: true,
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

    _setup(options) {
      let target = Popcorn.dom.find(options.target);
      const container = document.createElement('div');
      const innerContainer = document.createElement('div');
      const innerDiv = document.createElement('div');
      const innerSpan = document.createElement('span');
      // removed interface animations to make it more user friendly
      // const transition = options.transition ||
      // options._natives.manifest.options.transition.default;
      const transition = options._natives.manifest.options.transition.default;
      const { text, linkUrl } = options;
      const shadowColor = options.shadowColor || DEFAULT_SHADOW_COLOR;
      const backgroundColor = options.backgroundColor || DEFAULT_BACKGROUND_COLOR;
      const strokeColor = options.strokeColor || DEFAULT_STROKE_COLOR;
      const rotation = options.rotation || 0;
      const context = this;
      const fontDecorations = options.fontDecorations
        || options._natives.manifest.options.fontDecorations.default;
      const padding = '3';
      const width = 100 - (padding * 2);
      let { alignment } = options;
      let position = options.position || options._natives.manifest.options.position.default;
      let linkUrlSpan;

      options._container = container;
      options._context = context;

      if (!target) {
        target = this.media.parentNode;
      }

      options._target = target;
      container.style.position = 'absolute';
      container.style.transform = `rotate(${rotation}deg)`;
      container.style['-webkit-transform'] = `rotate(${rotation}deg)`;
      container.style['-moz-transform'] = `rotate(${rotation}deg)`;
      container.style['-ms-transform'] = `rotate(${rotation}deg)`;
      container.classList.add('popcorn-text');

      innerDiv.style.width = '100%';
      innerDiv.style.height = '100%';
      innerDiv.style.display = 'flex';
      innerDiv.style['align-items'] = 'flex-start';

      // backwards comp
      if ('center left right'.match(position)) {
        alignment = position;
        position = 'middle';
      }

      // innerSpan inside innerDiv is to allow zindex from layers to work properly.
      // if you mess with this code, make sure to check for zindex issues.
      innerDiv.appendChild(innerSpan);
      innerContainer.appendChild(innerDiv);
      container.appendChild(innerContainer);
      target.appendChild(container);

      // Add transition class
      // There is a special case where popup has to be added to the innerSpan,
      // not the outer container.
      options._transitionContainer = container;

      options._transitionContainer.classList.add(transition);
      options._transitionContainer.classList.add('off');

      // Handle all custom fonts/styling
      options.fontColor = options.fontColor || DEFAULT_FONT_COLOR;
      innerContainer.classList.add('text-inner-div');
      innerContainer.style.color = options.fontColor;
      innerContainer.style.fontStyle = fontDecorations.italics ? 'italic' : 'normal';
      innerContainer.style.fontWeight = fontDecorations.bold ? 'bold' : 'normal';


      function runTextfill() {
        if (!options.fontDecorations.responsive) {
          return;
        }
        const alignTokenHelpers = () => {
          const fontSize = +innerDiv.querySelector('span').style.fontSize.slice(0, -2);
          innerDiv.querySelectorAll('.token-uppercase').forEach((element) => {
            element.style.height = `${fontSize + 4}px`;
          });
          innerDiv.querySelectorAll('.token-default').forEach((element) => {
            element.style.height = `${fontSize + 4}px`;
          });
        };
        const resizeOptions = {
          innerTag: 'span',
          maxFontPixels: -1,
          explicitWidth: container.clientWidth,
          explicitHeight: container.clientHeight,
        };

        alignTokenHelpers();
        jQuery(innerDiv).textfill(resizeOptions);
        alignTokenHelpers();
      }

      if (options.background) {
        container.style.backgroundColor = backgroundColor;
      }
      if (options.shadow) {
        innerContainer.style.textShadow = `0 1px 5px ${shadowColor}, 0 1px 10px ${shadowColor}`;
      }

      if (options.stroke) {
        if (/WebKit/.test(navigator.userAgent)) {
          innerContainer.style.webkitTextStroke = `${options.fontSize * 0.2}px ${strokeColor}`;
        } else {
          innerContainer.style.textShadow = `-${options.fontSize * 0.2}px -${options.fontSize * 0.2}px 0 ${strokeColor}, ${options.fontSize * 0.2}px -${options.fontSize * 0.2}px 0 ${strokeColor}, -${options.fontSize * 0.2}px ${options.fontSize * 0.2}px 0 ${strokeColor}, ${options.fontSize * 0.2}px ${options.fontSize * 0.2}px 0 ${strokeColor}`;
        }
      }

      const fontSheet = document.createElement('link');
      fontSheet.rel = 'stylesheet';
      fontSheet.type = 'text/css';
      options.fontFamily = options.fontFamily
        ? options.fontFamily
        : options._natives.manifest.options.fontFamily.default;
      // Store reference to generated sheet for removal later, remove any existing ones
      options._fontSheet = fontSheet;

      fontSheet.onload = () => {
        innerContainer.style.fontFamily = `"${options.fontFamily}"`;

        if (options.fontDecorations.responsive) {
          /*
            wait for the elements to be rendered using their fonts
          */

          setTimeout(runTextfill, 30);

          if (window.systemVars) {
            let timer;
            jQuery(window).resize(() => {
              clearTimeout(timer);
              timer = setTimeout(runTextfill, 30);
            });
          }
        }
      };

      document.head.appendChild(fontSheet);

      if (options.fontDecorations.responsive) {
        runTextfill();
      } else {
        innerContainer.style.fontSize = `${options.fontSize}%`;
        innerSpan.style.width = '100%';
        innerSpan.style.height = '100%';
        innerDiv.querySelectorAll('.token-uppercase').forEach((element) => {
          element.style.height = getAbsoluteStyleDimension(element, 'fontSize');
        });
        innerDiv.querySelectorAll('.token-default').forEach((element) => {
          element.style.height = getAbsoluteStyleDimension(element, 'fontSize');
        });
      }
      container.classList.add('text-custom');

      let flexAlignment;
      let textAlignment;
      switch (alignment) {
        case 'center':
          flexAlignment = 'center';
          textAlignment = 'center';
          break;
        case 'right':
          flexAlignment = 'flex-end';
          textAlignment = 'right';
          break;
        default:
          flexAlignment = 'flex-start';
          textAlignment = 'left';
          break;
      }

      innerDiv.style['justify-content'] = flexAlignment;
      innerDiv.classList.add(textAlignment);

      if (position === 'top') {
        container.style.left = `${padding}%`;
        container.style.width = `${width}%`;
        container.style.top = `${padding}%`;
      } else if (position === 'bottom') {
        container.style.left = `${padding}%`;
        container.style.width = `${width}%`;
        container.style.top = `${100 - padding - options.fontSize}%`;
      } else if (position === 'middle') {
        container.style.left = `${padding}%`;
        container.style.width = `${width}%`;
        container.style.top = `${50 - (options.fontSize / 2)}%`;
      } else if (position === 'custom') {
        container.style.left = `${options.left}%`;
        container.style.top = `${options.top}%`;
        if (options.width) {
          container.style.width = `${options.width}%`;
        }
        if (!options.fontDecorations.responsive) {
          container.style.maxHeight = `${100 - options.top}%`;
        }
      }
      if (options.fontDecorations.responsive) {
        if (options.height) {
          container.style.height = `${options.height}%`;
          innerContainer.style.height = '100%';
        }
        runTextfill();
      } else {
        container.style.height = 'unset';
      }
      container.style.zIndex = +options.zindex;

      if (linkUrl) {
        const linkDiv = document.createElement('div');
        const linkTextSpan = document.createElement('span');
        const linkUrlDiv = (
          options._container && options._container.querySelector('.url-container')
        ) || document.createElement('div');

        const linkMarkerIcon = document.createElement('span');
        linkMarkerIcon.classList.add('fa');
        linkMarkerIcon.classList.add('fa-link');
        linkMarkerIcon.setAttribute('title', 'This input supports URLs.');
        linkUrlDiv.appendChild(linkMarkerIcon);

        // const { currentUser } = options._context;
        // if (currentUser && currentUser.features.clickToPhoneCall
        //   && currentUser.features.clickToPhoneCall.state === 'enabled') {
        //   const phoneMarkerIcon = document.createElement('span');
        //   phoneMarkerIcon.classList.add('fa');
        //   phoneMarkerIcon.classList.add('fa-phone');
        //   phoneMarkerIcon.setAttribute('title', 'This input supports phone numbers.');
        //   linkUrlDiv.appendChild(phoneMarkerIcon);
        // }

        linkDiv.classList.add('span-container');
        linkDiv.style.fontFamily = `"${options.fontFamily}"`;
        linkTextSpan.classList.add('text-container');
        linkTextSpan.style.fontFamily = `"${options.fontFamily}"`;
        linkUrlDiv.classList.add('url-container');

        linkUrlSpan = document.createElement('span');
        linkUrlSpan.classList.add('link-url-span');
        linkUrlSpan.style.fontFamily = `"${options.fontFamily}"`;
        linkUrlDiv.appendChild(linkUrlSpan);

        linkTextSpan.innerHTML = wrapTokens(options.text);
        if (options.linkUrl) {
          linkUrlSpan.innerHTML = wrapTokens(options.linkUrl);
        }
        linkDiv.appendChild(linkTextSpan);
        if (options._container && !options._container.querySelector('.url-container')) {
          options._container.appendChild(linkUrlDiv);
        }

        linkTextSpan.addEventListener('click', catchCaretCharacterOffsetWithin(options, 'text'));
        linkTextSpan.addEventListener('keyup', catchCaretCharacterOffsetWithin(options, 'text'));
        linkTextSpan.addEventListener('input', catchCaretCharacterOffsetWithin(options, 'text'));
        linkTextSpan.classList.add('personalizer-input');
        linkTextSpan.addEventListener('input', (event) => {
          options.text = unwrapTokens(event.target.innerHTML);
          if (options.fontDecorations.responsive) {
            runTextfill();
          }
          context.emit('elementUpdated', {
            type: 'text',
            element: options,
            options: {
              text: options.text,
            },
          });
          const caretPositionShifting = options.caretOffsets.text.length
            - prettyPrintTokens(
              event.target.innerText.substr(0, options.caretOffsets.text),
            ).length;
          if (caretPositionShifting > 0) {
            event.target.innerHTML = wrapTokens(options.text);
            options.caretOffsets.text -= caretPositionShifting;
            const selection = window.getSelection();
            if (selection) {
              let offset = options.caretOffsets.text;
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
        linkTextSpan.addEventListener('paste', (e) => {
          e.preventDefault();
          const sanitizingElem = document.createElement('DIV');
          sanitizingElem.innerHTML = unwrapTokens((e.clipboardData || window.clipboardData).getData('text/plain'));
          const pasteString = sanitizingElem.textContent || sanitizingElem.innerText || '';
          document.execCommand('insertHTML', false, wrapTokens(pasteString));
        });
        linkUrlDiv.addEventListener('click', catchCaretCharacterOffsetWithin(options, 'linkUrl'));
        linkUrlDiv.addEventListener('keyup', catchCaretCharacterOffsetWithin(options, 'linkUrl'));
        linkUrlDiv.addEventListener('input', catchCaretCharacterOffsetWithin(options, 'text'));
        linkUrlSpan.setAttribute('contenteditable', '');
        linkUrlSpan.addEventListener('input', (event) => {
          if (event.target.firstChild && event.target.firstChild.tagName === 'SPAN') {
            options.linkUrl = unwrapTokens(event.target.firstChild.innerHTML);
          } else {
            options.linkUrl = unwrapTokens(event.target.innerHTML);
          }
          context.emit('elementUpdated', {
            type: 'text',
            element: options,
            options: {
              linkUrl: options.linkUrl,
            },
          });
          const caretPositionShifting = options.caretOffsets.linkUrl.length
            - prettyPrintTokens(
              event.target.innerText.substr(0, options.caretOffsets.linkUrl),
            ).length;
          if (caretPositionShifting > 0) {
            event.target.innerHTML = wrapTokens(options.linkUrl);
            options.caretOffsets.linkUrl -= caretPositionShifting;
            const selection = window.getSelection();
            if (selection) {
              let offset = options.caretOffsets.linkUrl;
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
        options._contentContainer = linkTextSpan;

        linkDiv.style.color = innerContainer.style.color;

        innerSpan.appendChild(linkDiv);
      } else {
        innerSpan.innerHTML = wrapTokens(text);
        innerSpan.addEventListener('click', catchCaretCharacterOffsetWithin(options, 'text'));
        innerSpan.addEventListener('keyup', catchCaretCharacterOffsetWithin(options, 'text'));
        innerSpan.addEventListener('input', catchCaretCharacterOffsetWithin(options, 'text'));
        innerSpan.classList.add('personalizer-input');
        innerSpan.addEventListener('input', (event) => {
          options.text = unwrapTokens(event.target.innerHTML);
          if (options.fontDecorations.responsive) {
            runTextfill();
          }
          context.emit('elementUpdated', {
            type: 'text',
            element: options,
            options: {
              text: options.text,
            },
          });
          const caretPositionShifting = options.caretOffsets.text.length
            - prettyPrintTokens(
              event.target.innerText.substr(0, options.caretOffsets.text),
            ).length;
          if (caretPositionShifting > 0) {
            event.target.innerHTML = wrapTokens(options.text);
            options.caretOffsets.text -= caretPositionShifting;
            const selection = window.getSelection();
            if (selection) {
              let offset = options.caretOffsets.text;
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
        options._contentContainer = innerSpan;
      }

      options._container.addEventListener('dblclick', () => {
        options._contentContainer.setAttribute('contenteditable', '');
        options._contentContainer.focus();
        const editTooltip = options._container.querySelector('.edit-tooltip');
        if (editTooltip) {
          editTooltip.classList.add('hidden');
        }
        updateDraggableResizable(options, { draggable: false, resizable: true }, runTextfill);
      });

      context.on('elementSelected', (event) => {
        const { element } = event;
        const shouldRunTextfill = element !== options
          ? options._container.classList.contains('active')
          : !options._container.classList.contains('active');
        if (options._container) {
          options._container.classList[element === options ? 'add' : 'remove']('active');
        }
        if (element !== options) {
          options._contentContainer.removeAttribute('contenteditable');
          updateDraggableResizable(options, { draggable: true, resizable: true }, runTextfill);
        }
        if (shouldRunTextfill) {
          runTextfill();
        }
      });

      options._contentSpan = innerSpan;

      options._container.addEventListener('click', (event) => {
        event.stopPropagation();
        // const { currentUser } = options._context;
        if (!options.linkUrl) {
          // linkUrlSpan.innerHTML =
          // wrapTokens(callToActionFeature[currentUser.features.clickToPhoneCall.state]);
        }
        // options._container.querySelector('*[contenteditable=""]').focus();
        context.emit('elementSelected', {
          element: options,
        });
      });

      const editTooltip = document.createElement('span');
      editTooltip.classList.add('edit-tooltip');
      editTooltip.classList.add('hidden');
      // editTooltip.textContent = 'Double click to edit';

      options._container.addEventListener('mouseenter', () => {
        if (!options._container.querySelector('.personalizer-input[contenteditable=""]')
          && options._container.classList.contains('active')) {
          options._container.querySelector('.edit-tooltip').classList.remove('hidden');
        }
      });
      options._container.addEventListener('mouseleave', () => {
        options._container.querySelector('.edit-tooltip').classList.add('hidden');
      });
      options._container.appendChild(editTooltip);

      fontSheet.href = `https://fonts.googleapis.com/css?family=${options.fontFamily.replace(/\s/g, '+')}:400,700`;

      options.toString = () => (options.text || options._natives.manifest.options.text.default);

      buildScripts(options);

      updateDraggableResizable(options, { draggable: true, resizable: true }, runTextfill);
      extendObservable(options, {
        fontFamily: options.fontFamily,
        fontSize: options.fontSize,
        fontDecorations: options.fontDecorations,
        backgroundColor: options.backgroundColor,
        fontColor: options.fontColor,
        alignment: options.alignment,
        text: options.text,
        linkUrl: options.linkUrl,
        callNotifyAddress: options.callNotifyAddress,
      });
    },

    // TODO: showing on canvas
    start(event, options) {
      if (!isSafari()) {
        const transitionContainer = options._transitionContainer;

        if (transitionContainer) {
          // Safari Redraw hack - #3066
          const safariHack = () => {
            transitionContainer.style.display = 'none';
            transitionContainer.style.display = '';
          };

          transitionContainer.classList.add('on');
          transitionContainer.classList.remove('off');

          if (['popcorn-fade', 'popcorn-slide-up', 'popcorn-slide-down'].indexOf(options.transition) === -1) {
            safariHack();
          } else {
            setTimeout(safariHack, 430);
          }
        }

        if (options.fontDecorations.responsive) {
          // perform textfill
          (() => {
            const resizeOptions = {
              innerTag: 'span',
              maxFontPixels: -1,
              explicitWidth: transitionContainer.clientWidth,
              explicitHeight: transitionContainer.clientHeight,
            };
            jQuery(transitionContainer.childNodes[0].childNodes[0]).textfill(resizeOptions);
          })();
        }

        buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
          options.scripts._compiled.onStart();
        }
      } else {
        setTimeout(() => {
          const transitionContainer = options._transitionContainer;

          if (transitionContainer) {
            // Safari Redraw hack - #3066
            const safariHack = () => {
              transitionContainer.style.display = 'none';
              transitionContainer.style.display = '';
            };

            transitionContainer.classList.add('on');
            transitionContainer.classList.remove('off');

            if (['popcorn-fade', 'popcorn-slide-up', 'popcorn-slide-down'].indexOf(options.transition) === -1) {
              safariHack();
            } else {
              setTimeout(safariHack, 430);
            }
          }

          // perform textfill
          (() => {
            const resizeOptions = {
              innerTag: 'span',
              maxFontPixels: -1,
              explicitWidth: transitionContainer.clientWidth,
              explicitHeight: transitionContainer.clientHeight,
            };
            jQuery(transitionContainer.childNodes[0].childNodes[0]).textfill(resizeOptions);
          })();

          buildScripts(options);
          if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
            options.scripts._compiled.onStart();
          }
        }, 430);
      }
      if (document.querySelector('fieldset [data-manifest-key="fontSize"]')) {
        if (options.fontDecorations.responsive) {
          document.querySelector('fieldset [data-manifest-key="fontSize"]').setAttribute('disabled', true);
        } else {
          document.querySelector('fieldset [data-manifest-key="fontSize"]').removeAttribute('disabled');
        }
      }
    },

    // TODO: update settings in DB (trackEvents)
    _update(trackEvent, options) {
      function runTextfill() {
        if (!trackEvent.fontDecorations.responsive) {
          return;
        }
        const alignTokenHelpers = () => {
          const fontSize = +trackEvent._transitionContainer.firstChild.firstChild.querySelector('span').style.fontSize.slice(0, -2);
          trackEvent._transitionContainer.firstChild.firstChild.querySelectorAll('.token-uppercase').forEach((element) => {
            element.style.height = `${fontSize + 4}px`;
          });
          trackEvent._transitionContainer.firstChild.firstChild.querySelectorAll('.token-default').forEach((element) => {
            element.style.height = `${fontSize + 4}px`;
          });
        };
        const resizeOptions = {
          innerTag: 'span',
          maxFontPixels: -1,
          explicitWidth: trackEvent._transitionContainer.clientWidth,
          explicitHeight: trackEvent._transitionContainer.clientHeight,
        };

        alignTokenHelpers();
        jQuery(trackEvent._transitionContainer.firstChild.firstChild).textfill(resizeOptions);
        // re-run to set correct size for token
        alignTokenHelpers();
      }

      if (options.fontFamily !== undefined && options.fontFamily !== trackEvent.fontFamily) {
        trackEvent.fontFamily = options.fontFamily;
        const fontSheet = document.createElement('link');
        fontSheet.rel = 'stylesheet';
        fontSheet.type = 'text/css';
        trackEvent.fontFamily = trackEvent.fontFamily
          ? trackEvent.fontFamily
          : trackEvent._natives.manifest.options.fontFamily.default;
        // Store reference to generated sheet for removal later, remove any existing ones
        trackEvent._fontSheet = fontSheet;

        fontSheet.onload = () => {
          trackEvent._container.firstChild.style.fontFamily = `"${options.fontFamily}"`;

          if (trackEvent.fontDecorations.responsive) {
            /*
              wait for the elements to be rendered using their fonts
            */

            setTimeout(runTextfill, 30);

            if (window.systemVars) {
              let timer;
              jQuery(window).resize(() => {
                clearTimeout(timer);
                timer = setTimeout(runTextfill, 30);
              });
            }
          }
        };
        document.head.appendChild(fontSheet);
        fontSheet.href = `https://fonts.googleapis.com/css?family=${options.fontFamily.replace(/\s/g, '+')}:400,700`;
      }

      if (options.left !== undefined && options.left !== trackEvent.left) {
        trackEvent.left = options.left;
      }

      if (options.width !== undefined && options.width !== trackEvent.width) {
        trackEvent.width = options.width;
      }

      if (options.padding !== undefined && options.padding !== trackEvent.padding) {
        trackEvent.padding = options.padding;
      }

      if (options.top !== undefined && options.top !== trackEvent.top) {
        trackEvent.top = options.top;
      }

      if (options.fontSize !== undefined && options.fontSize !== trackEvent.fontSize) {
        trackEvent.fontSize = options.fontSize;
      }

      if (options.zindex !== undefined && options.zindex !== trackEvent.zindex) {
        trackEvent.zindex = options.zindex;
      }

      if (options.fontDecorations !== undefined
        && options.fontDecorations !== trackEvent.fontDecorations) {
        const { fontDecorations } = options;
        if (fontDecorations.bold !== undefined
          && fontDecorations.bold !== trackEvent.fontDecorations.bold) {
          trackEvent.fontDecorations.bold = fontDecorations.bold;
        }
        if (fontDecorations.italics !== undefined
          && fontDecorations.italics !== trackEvent.fontDecorations.italics) {
          trackEvent.fontDecorations.italics = fontDecorations.italics;
        }
        if (fontDecorations.responsive !== undefined
          && fontDecorations.responsive !== trackEvent.fontDecorations.responsive) {
          trackEvent.fontDecorations.responsive = fontDecorations.responsive;
        }
      }

      if (options.transition !== undefined && options.transition !== trackEvent.transition) {
        trackEvent._transitionContainer.classList.remove(trackEvent.transition);
        trackEvent.transition = options.transition;
      }

      if (options.rotation !== undefined && options.rotation !== trackEvent.rotation) {
        trackEvent.rotation = options.rotation;
      }

      if (options.fontColor !== undefined && options.fontColor !== trackEvent.fontColor) {
        trackEvent.fontColor = options.fontColor;
      }

      if (options.shadow !== undefined && options.shadow !== trackEvent.shadow) {
        trackEvent.shadow = options.shadow;
      }

      if (options.shadowColor !== undefined && options.shadowColor !== trackEvent.shadowColor) {
        trackEvent.shadowColor = options.shadowColor;
      }

      if (options.background !== undefined && options.background !== trackEvent.background) {
        trackEvent.background = options.background;
      }

      if (options.backgroundColor !== undefined
        && options.backgroundColor !== trackEvent.backgroundColor) {
        trackEvent.backgroundColor = options.backgroundColor;
      }

      if (options.stroke !== undefined && options.stroke !== trackEvent.stroke) {
        trackEvent.stroke = options.stroke;
      }

      if (options.strokeColor !== undefined && options.strokeColor !== trackEvent.strokeColor) {
        trackEvent.strokeColor = options.strokeColor;
      }

      if (options.alignment !== undefined && options.alignment !== trackEvent.alignment) {
        trackEvent._container.firstChild.firstChild.classList.remove(trackEvent.alignment);
        trackEvent.alignment = options.alignment;
      }

      if (options.position !== undefined && options.position !== trackEvent.position) {
        trackEvent.position = options.position;
      }

      if (options.strokeColor !== undefined && options.strokeColor !== trackEvent.strokeColor) {
        trackEvent.strokeColor = options.strokeColor;
      }

      if (options.text !== undefined && options.text !== trackEvent.text) {
        trackEvent.text = options.text;
      }

      if (options.linkUrl !== undefined && options.linkUrl !== trackEvent.linkUrl) {
        trackEvent.linkUrl = options.linkUrl;
      }

      if (options.callNotifyAddress !== undefined
        && options.callNotifyAddress !== trackEvent.callNotifyAddress) {
        trackEvent.callNotifyAddress = options.callNotifyAddress;
      }

      if (options.linkTarget !== undefined && options.linkTarget !== trackEvent.linkTarget) {
        trackEvent.linkTarget = options.linkTarget;
      }

      const spanContainer = trackEvent._contentSpan.parentNode;
      spanContainer.removeChild(trackEvent._contentSpan);
      const innerSpan = document.createElement('span');
      if (trackEvent.linkUrl) {
        const linkDiv = document.createElement('div');
        const linkTextSpan = document.createElement('span');
        const linkUrlDiv = (
          trackEvent._container && trackEvent._container.querySelector('.url-container')
        ) || document.createElement('div');

        if (!linkUrlDiv.querySelector('.fa-link')) {
          const linkMarkerIcon = document.createElement('span');
          linkMarkerIcon.classList.add('fa');
          linkMarkerIcon.classList.add('fa-link');
          linkMarkerIcon.setAttribute('title', 'This input supports URLs.');
          linkUrlDiv.appendChild(linkMarkerIcon);
        }

        // if (!linkUrlDiv.querySelector('.fa-phone')) {
        //   const { currentUser } = trackEvent._context;
        //   if (currentUser && currentUser.features.clickToPhoneCall
        //     && currentUser.features.clickToPhoneCall.state === 'enabled') {
        //     const phoneMarkerIcon = document.createElement('span');
        //     phoneMarkerIcon.classList.add('fa');
        //     phoneMarkerIcon.classList.add('fa-phone');
        //     phoneMarkerIcon.setAttribute('title', 'This input supports phone numbers.');
        //     linkUrlDiv.appendChild(phoneMarkerIcon);
        //   }
        // }

        linkDiv.classList.add('span-container');
        linkTextSpan.classList.add('text-container');
        linkUrlDiv.classList.add('url-container');

        const linkUrlSpan = !trackEvent._container.querySelector('.url-container')
          ? document.createElement('span')
          : linkUrlDiv.querySelector('.link-url-span');
        if (!trackEvent._container.querySelector('.url-container')) {
          linkUrlSpan.classList.add('link-url-span');
          linkUrlSpan.setAttribute('contenteditable', '');
          linkUrlSpan.addEventListener('input', (event) => {
            if (event.target.firstChild && event.target.firstChild.tagName === 'SPAN') {
              trackEvent.linkUrl = unwrapTokens(event.target.firstChild.innerHTML);
            } else {
              trackEvent.linkUrl = unwrapTokens(event.target.innerHTML);
            }
            trackEvent._context.emit('elementUpdated', {
              type: 'text',
              element: trackEvent,
              options: {
                linkUrl: trackEvent.linkUrl,
              },
            });
            const caretPositionShifting = trackEvent.caretOffsets.linkUrl.length
              - prettyPrintTokens(
                event.target.innerText.substr(0, trackEvent.caretOffsets.linkUrl),
              ).length;
            if (caretPositionShifting > 0) {
              event.target.innerHTML = wrapTokens(trackEvent.linkUrl);
              trackEvent.caretOffsets.linkUrl -= caretPositionShifting;
              const selection = window.getSelection();
              if (selection) {
                let offset = trackEvent.caretOffsets.linkUrl;
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
          linkUrlDiv.appendChild(linkUrlSpan);
        }

        linkTextSpan.innerHTML = wrapTokens(trackEvent.text);
        linkUrlSpan.innerHTML = wrapTokens(trackEvent.linkUrl);
        linkDiv.appendChild(linkTextSpan);
        if (trackEvent._container && !trackEvent._container.querySelector('.url-container')) {
          trackEvent._container.appendChild(linkUrlDiv);
        }

        linkTextSpan.addEventListener('click', catchCaretCharacterOffsetWithin(trackEvent, 'text'));
        linkTextSpan.addEventListener('keyup', catchCaretCharacterOffsetWithin(trackEvent, 'text'));
        linkTextSpan.addEventListener('input', catchCaretCharacterOffsetWithin(trackEvent, 'text'));
        linkTextSpan.classList.add('personalizer-input');
        linkTextSpan.addEventListener('input', (event) => {
          trackEvent.text = unwrapTokens(event.target.innerHTML);
          if (trackEvent.fontDecorations.responsive) {
            runTextfill();
          }
          trackEvent._context.emit('elementUpdated', {
            type: 'text',
            element: trackEvent,
            options: {
              text: trackEvent.text,
            },
          });
          const caretPositionShifting = trackEvent.caretOffsets.text.length
            - prettyPrintTokens(
              event.target.innerText.substr(0, trackEvent.caretOffsets.text),
            ).length;
          if (caretPositionShifting > 0) {
            event.target.innerHTML = wrapTokens(trackEvent.text);
            trackEvent.caretOffsets.text -= caretPositionShifting;
            const selection = window.getSelection();
            if (selection) {
              let offset = trackEvent.caretOffsets.text;
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
        linkTextSpan.addEventListener('paste', (e) => {
          e.preventDefault();
          const sanitizingElem = document.createElement('DIV');
          sanitizingElem.innerHTML = unwrapTokens((e.clipboardData || window.clipboardData).getData('text/plain'));
          const pasteString = sanitizingElem.textContent || sanitizingElem.innerText || '';
          document.execCommand('insertHTML', false, wrapTokens(pasteString));
        });
        linkUrlDiv.addEventListener('click', catchCaretCharacterOffsetWithin(trackEvent, 'linkUrl'));
        linkUrlDiv.addEventListener('keyup', catchCaretCharacterOffsetWithin(trackEvent, 'linkUrl'));
        linkUrlDiv.addEventListener('input', catchCaretCharacterOffsetWithin(trackEvent, 'linkUrl'));
        trackEvent._contentContainer = linkTextSpan;

        linkDiv.style.fontFamily = `"${trackEvent.fontFamily}"`;

        innerSpan.appendChild(linkDiv);
      } else {
        innerSpan.innerHTML = wrapTokens(trackEvent.text);
        innerSpan.addEventListener('click', catchCaretCharacterOffsetWithin(trackEvent, 'text'));
        innerSpan.addEventListener('keyup', catchCaretCharacterOffsetWithin(trackEvent, 'text'));
        innerSpan.classList.add('personalizer-input');
        innerSpan.addEventListener('input', (event) => {
          trackEvent.text = unwrapTokens(event.target.innerHTML);
          if (trackEvent.fontDecorations.responsive) {
            runTextfill();
          }
          trackEvent._context.emit('elementUpdated', {
            type: 'text',
            element: trackEvent,
            options: {
              text: trackEvent.text,
            },
          });
          const caretPositionShifting = trackEvent.caretOffsets.text.length
            - prettyPrintTokens(
              event.target.innerText.substr(0, trackEvent.caretOffsets.text),
            ).length;
          if (caretPositionShifting > 0) {
            event.target.innerHTML = wrapTokens(trackEvent.text);
            trackEvent.caretOffsets.text -= caretPositionShifting;
            const selection = window.getSelection();
            if (selection) {
              let offset = trackEvent.caretOffsets.text;
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
        trackEvent._contentContainer = innerSpan;
      }
      spanContainer.append(innerSpan);
      trackEvent._contentContainer.addEventListener('dblclick', () => {
        trackEvent._contentContainer.setAttribute('contenteditable', '');
        trackEvent._contentContainer.focus();
        trackEvent._container.querySelector('.edit-tooltip').classList.add('hidden');
        updateDraggableResizable(trackEvent, { draggable: false, resizable: true }, runTextfill);
      });
      trackEvent._context.on('elementSelected', (event) => {
        const { element } = event;
        const shouldRunTextfill = element !== trackEvent
          ? trackEvent._container.classList.contains('active')
          : !trackEvent._container.classList.contains('active');
        if (trackEvent._container) {
          trackEvent._container.classList[element === trackEvent ? 'add' : 'remove']('active');
        }
        if (element !== trackEvent) {
          trackEvent._contentContainer.removeAttribute('contenteditable');
          updateDraggableResizable(trackEvent, { draggable: true, resizable: true }, runTextfill);
        }
        if (shouldRunTextfill) {
          runTextfill();
        }
      });
      trackEvent._container.addEventListener('click', (event) => {
        event.stopPropagation();
        // trackEvent._container.querySelector('*[contenteditable=""]').focus();
        trackEvent._context.emit('elementSelected', {
          element: trackEvent,
        });
      });
      trackEvent._contentSpan = innerSpan;

      const padding = '3';
      const width = 100 - (padding * 2);
      if (trackEvent.position === 'top') {
        trackEvent._container.style.left = `${padding}%`;
        trackEvent._container.style.width = `${width}%`;
        trackEvent._container.style.top = `${padding}%`;
      } else if (trackEvent.position === 'bottom') {
        trackEvent._container.style.left = `${padding}%`;
        trackEvent._container.style.width = `${width}%`;
        trackEvent._container.style.top = `${100 - padding - trackEvent.fontSize}%`;
      } else if (trackEvent.position === 'middle') {
        trackEvent._container.style.left = `${padding}%`;
        trackEvent._container.style.width = `${width}%`;
        trackEvent._container.style.top = `${50 - (trackEvent.fontSize / 2)}%`;
      } else if (trackEvent.position === 'custom') {
        trackEvent._container.style.left = `${trackEvent.left}%`;
        trackEvent._container.style.top = `${trackEvent.top}%`;
        if (trackEvent.width) {
          trackEvent._container.style.width = `${trackEvent.width}%`;
        }
        if (!trackEvent.fontDecorations.responsive) {
          trackEvent._container.style.height = '';
          trackEvent._container.style.maxHeight = `${100 - trackEvent.top}%`;
        }
      }
      if (trackEvent.fontDecorations.responsive) {
        if (trackEvent.height) {
          trackEvent._container.style.height = `${trackEvent.height}%`;
          trackEvent._container.firstChild.style.height = '100%';
        }
        trackEvent._container.querySelector('.text-inner-div').style['overflow-y'] = 'visible';
        runTextfill();
      } else if (!trackEvent.fontDecorations.responsive) {
        trackEvent._container.firstChild.style.fontSize = `${trackEvent.fontSize}%`;
        trackEvent._container.querySelector('.text-inner-div').style['overflow-y'] = 'auto';
        const containerInnerSpan = trackEvent._container.firstChild.querySelector('span');
        containerInnerSpan.style.width = '100%';
        containerInnerSpan.style.height = '100%';
        trackEvent._transitionContainer.firstChild.firstChild
          .querySelectorAll('.token-uppercase').forEach((element) => {
            element.style.height = getAbsoluteStyleDimension(element, 'fontSize');
          });
        trackEvent._transitionContainer.firstChild.firstChild
          .querySelectorAll('.token-default').forEach((element) => {
            element.style.height = getAbsoluteStyleDimension(element, 'fontSize');
          });
      }
      trackEvent._container.style.zIndex = +trackEvent.zindex;
      trackEvent._container.firstChild.style.fontStyle = trackEvent.fontDecorations.italics ? 'italic' : 'normal';
      trackEvent._container.firstChild.style.fontWeight = trackEvent.fontDecorations.bold ? 'bold' : 'normal';
      trackEvent._container.style.transform = `rotate(${trackEvent.rotation || 0}deg)`;
      trackEvent._container.style['-webkit-transform'] = `rotate(${trackEvent.rotation || 0}deg)`;
      trackEvent._container.style['-moz-transform'] = `rotate(${trackEvent.rotation || 0}deg)`;
      trackEvent._container.style['-ms-transform'] = `rotate(${trackEvent.rotation || 0}deg)`;
      trackEvent._container.firstChild.style.color = trackEvent.fontColor;

      if (trackEvent.background) {
        trackEvent._container.style.backgroundColor = trackEvent.backgroundColor;
      }

      if (trackEvent.shadow) {
        trackEvent._container.firstChild.style.textShadow = `0 1px 5px ${trackEvent.shadowColor}, 0 1px 10px ${trackEvent.shadowColor}`;
      }

      if (trackEvent.stroke) {
        if (/WebKit/.test(navigator.userAgent)) {
          trackEvent._container.firstChild.style.webkitTextStroke = `${trackEvent.fontSize * 0.2}px ${trackEvent.strokeColor}`;
        } else {
          trackEvent._container.firstChild.style.textShadow = `-${trackEvent.fontSize * 0.2}px -${trackEvent.fontSize * 0.2}px 0 ${trackEvent.strokeColor}, ${trackEvent.fontSize * 0.2}px -${trackEvent.fontSize * 0.2}px 0 ${trackEvent.strokeColor}, -${trackEvent.fontSize * 0.2}px ${trackEvent.fontSize * 0.2}px 0 ${trackEvent.strokeColor}, ${trackEvent.fontSize * 0.2}px ${trackEvent.fontSize * 0.2}px 0 ${trackEvent.strokeColor}`;
        }
      }

      let flexAlignment;
      let textAlignment;
      switch (trackEvent.alignment) {
        case 'center':
          flexAlignment = 'center';
          textAlignment = 'center';
          break;
        case 'right':
          flexAlignment = 'flex-end';
          textAlignment = 'right';
          break;
        default:
          flexAlignment = 'flex-start';
          textAlignment = 'left';
          break;
      }

      trackEvent._container.firstChild.firstChild.style['justify-content'] = flexAlignment;
      trackEvent._container.firstChild.firstChild.classList.add(textAlignment);

      updateDraggableResizable(trackEvent, { draggable: true, resizable: true }, runTextfill);
    },

    end(event, options) {
      if (!isSafari()) {
        if (options._transitionContainer) {
          options._transitionContainer.classList.remove('on');
          options._transitionContainer.classList.add('off');
        }

        buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
          options.scripts._compiled.onEnd();
        }
      } else {
        setTimeout(() => {
          if (options._transitionContainer) {
            options._transitionContainer.classList.remove('on');
            options._transitionContainer.classList.add('off');
          }

          buildScripts(options);
          if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
            options.scripts._compiled.onEnd();
          }
        }, 430);
      }
    },

    _teardown(options) {
      if (options._target) {
        options._target.removeChild(options._container);
      }

      if (options._fontSheet) {
        document.head.removeChild(options._fontSheet);
      }
    },
  });
})(window.Popcorn, window.jQuery);
