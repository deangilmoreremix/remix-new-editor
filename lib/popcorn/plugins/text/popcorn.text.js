/* eslint-disable no-underscore-dangle,no-new-func */
// PLUGIN: text

import fonts from '../../../constants/fonts';
import {
  FIELD_TEXT,
  HEIGHT,
  WIDTH,
  TOP,
  LINK_URL,
  LEFT,
  DEFAULT_FONT,
  FONT_DECORATIONS,
  POPCORN_ELEMENT_TYPES,
  ADVANCED_GROUP,
  CALL_NOTIFY_ADDRESS,
  LINKTARGET,
  ALIGNMENT,
  POSITION,
  START,
  END,
  TRANSITION,
  ROTATION,
  FONT_FAMILY,
  FONT_SIZE,
  FONT_COLOR,
  SHADOW,
  SHADOW_COLOR,
  BACKGROUND,
  STROKE,
  BACKGROUND_COLOR,
  STROKE_COLOR,
  ZINDEX,
  ANIMATION,
  SCRIPTS, BOLD, ITALICS, RESPONSIVE,
} from '../../../constants/popcorn';
import {
  CHECKBOX,
  COLOR,
  INPUT,
  INPUT_ANGLE,
  INPUT_TEXTAREA, NUMBER,
  RADIO,
  SELECT,
  SLIDER,
  TIME,
} from '../../../constants/forms';

import { draggableResizable } from '../../helpers';
const { extendObservable } = require('mobx');

const { animationStart, animationEnd, updateIn, updateIdle, updateOut } = require('../../../../lib/utils/popcorn-animation');

const selectFonts = [];
fonts.map(item => (selectFonts.push({ label: item, value: item })));

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

  Popcorn.plugin(POPCORN_ELEMENT_TYPES.TEXT, {

    manifest: {
      about: {
        name: 'Popcorn text Plugin',
        version: '0.1',
        author: '@k88hudson, @mjschranz',
      },
      options: {
        [FIELD_TEXT]: {
          name: FIELD_TEXT,
          type: INPUT_TEXTAREA,
          label: 'Text',
          rows: '5',
          variant: 'outlined',
          default: 'Video Editor',
        },
        [LINK_URL]: {
          name: LINK_URL,
          type: INPUT,
          label: 'Link URL',
          placeholder: 'www.example.com',
        },
        [CALL_NOTIFY_ADDRESS]: {
          name: CALL_NOTIFY_ADDRESS,
          type: INPUT,
          label: 'Email to notify about call attempt',
          placeholder: 'example@gmail.com',
        },
        [LINKTARGET]: {
          name: LINKTARGET,
          type: SELECT,
          items: [
            { label: 'New Tab', value: '_blank' },
            { label: 'Current tab', value: '_parent' },
          ],
          default: { label: 'New Tab', value: '_blank' },
        },
        [POSITION]: {
          type: RADIO,
          name: POSITION,
          values: ['custom', 'middle', 'bottom', 'top'],
          label: 'Text Position',
          default: 'custom',
        },
        [ALIGNMENT]: {
          type: RADIO,
          name: ALIGNMENT,
          values: ['center', 'left', 'right'],
          default: 'left',
        },
        [START]: {
          name: START,
          type: TIME,
          label: 'Start',
          group: 'basic',
          default: 0,
        },
        [END]: {
          name: END,
          type: TIME,
          label: 'End',
          group: 'basic',
          default: 5,
        },
        [TRANSITION]: {
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
          default: 'popcorn-none',
        },
        [ROTATION]: {
          name: ROTATION,
          type: INPUT_ANGLE,
          label: 'Rotation',
          default: 0,
        },
        [FONT_FAMILY]: {
          name: FONT_FAMILY,
          items: selectFonts,
          type: SELECT,
          label: 'Font',
          googleFonts: true,
          group: ADVANCED_GROUP,
          default: { label: DEFAULT_FONT, value: DEFAULT_FONT },
        },
        [FONT_SIZE]: {
          name: FONT_SIZE,
          type: SLIDER,
          label: 'Font Size',
          default: 8,
          group: ADVANCED_GROUP,
          inputClassName: 'slider-input',
          sliderWidth: 300,
        },
        [FONT_COLOR]: {
          name: FONT_COLOR,
          type: COLOR,
          label: 'Font color',
          default: DEFAULT_FONT_COLOR,
          group: ADVANCED_GROUP,
        },
        [SHADOW]: {
          name: SHADOW,
          type: CHECKBOX,
          label: 'Shadow',
          default: false,
          group: ADVANCED_GROUP,
        },
        [SHADOW_COLOR]: {
          name: SHADOW_COLOR,
          type: COLOR,
          label: 'Shadow color',
          default: DEFAULT_SHADOW_COLOR,
          group: ADVANCED_GROUP,
        },
        [BACKGROUND]: {
          name: BACKGROUND,
          type: CHECKBOX,
          label: 'Background',
          default: false,
          group: ADVANCED_GROUP,
        },
        [BACKGROUND_COLOR]: {
          name: BACKGROUND_COLOR,
          type: COLOR,
          label: 'Background color',
          default: DEFAULT_BACKGROUND_COLOR,
          group: ADVANCED_GROUP,
        },
        [STROKE]: {
          name: STROKE,
          type: CHECKBOX,
          label: 'Stroke',
          default: false,
          group: ADVANCED_GROUP,
        },
        [STROKE_COLOR]: {
          name: STROKE_COLOR,
          type: COLOR,
          label: 'Stroke color',
          default: DEFAULT_STROKE_COLOR,
          group: ADVANCED_GROUP,
        },
        [FONT_DECORATIONS]: {
          name: FONT_DECORATIONS,
          [BOLD]: {
            name: BOLD,
            label: 'Bold',
            type: CHECKBOX,
          },
          [ITALICS]: {
            name: ITALICS,
            label: 'Italic',
            type: CHECKBOX,
          },
          [RESPONSIVE]: {
            name: RESPONSIVE,
            label: 'Scale To Fit',
            type: CHECKBOX,
          },
          default: { [BOLD]: false, [ITALICS]: false, [RESPONSIVE]: true },
          group: ADVANCED_GROUP,
        },
        [LEFT]: {
          type: NUMBER,
          label: 'Left',
          default: 25,
          hidden: true,
        },
        [TOP]: {
          type: NUMBER,
          label: 'Top',
          default: 0,
          hidden: true,
        },
        [WIDTH]: {
          type: NUMBER,
          label: 'Width',
          default: 50,
          hidden: true,
        },
        [HEIGHT]: {
          type: NUMBER,
          label: 'Height',
          default: 10,
          hidden: true,
        },
        [ZINDEX]: {
          hidden: true,
        },
        [SCRIPTS]: {
          onStart: '',
          onEnd: '',
        },
        [ANIMATION]: {
          default: {
            in: null,
            idle: null,
            out: null,
          },
          hidden: true,
        },
      },
    },

    _setup(options) {
      function toFillOptions(field) {
        if (options[field] !== undefined) {
          return options[field];
        } else {
          return options._natives.manifest.options[field].default;
        }
      }
      let target = Popcorn.dom.find(options.target);
      const container = document.createElement('div');
      const innerContainer = document.createElement('div');
      const innerDiv = document.createElement('div');
      const innerSpan = document.createElement('span');
      options.animation = options.animation || options._natives.manifest.options.animation.default;

      // only none (we not use it)
      options.transition = options._natives.manifest.options.transition.default;
      const top = toFillOptions(TOP);
      const text = toFillOptions(FIELD_TEXT);
      const linkUrl = options.linkUrl || options._natives.manifest.options.linkUrl.placeholder;
      const shadowColor = options.shadowColor || DEFAULT_SHADOW_COLOR;
      const backgroundColor = options.backgroundColor || DEFAULT_BACKGROUND_COLOR;
      const strokeColor = options.strokeColor || DEFAULT_STROKE_COLOR;
      const rotation = toFillOptions(ROTATION);
      const context = this;
      const fontDecorations = toFillOptions(FONT_DECORATIONS);
      const padding = '3';
      const width = 100 - (padding * 2);
      let alignment = toFillOptions(ALIGNMENT);
      let position = toFillOptions(POSITION);
      let linkUrlSpan;

      options.text = toFillOptions(FIELD_TEXT);
      options.fontDecorations = toFillOptions(FONT_DECORATIONS);

      options.left = toFillOptions(LEFT);
      options.height = toFillOptions(HEIGHT);
      options.width = toFillOptions(WIDTH);
      options.top = toFillOptions(TOP);
      options.linkUrl = toFillOptions(LINK_URL);
      options.alignment = toFillOptions(ALIGNMENT);

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

      // _transitionContainer

      options._animationContainer = container;

      options._animationContainer.classList.add('off');

      if (options.animation.idle) {
        options._animationContainer.classList.add('animated');
        // only for idle
        options._animationContainer.classList.add('infinite');
        options._animationContainer.classList.add(options.animation.idle.type);
      }

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

          jQuery(window).resize(() => {
            if (options.resizeTimer) {
              clearTimeout(options.resizeTimer);
            }
            options.resizeTimer = setTimeout(runTextfill, 30);
          });
        }
      };

      document.head.appendChild(fontSheet);

      options.fontSize = toFillOptions(FONT_SIZE);

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
        container.style.top = `${top}%`;
        if (options.width) {
          container.style.width = `${options.width}%`;
        }
        if (!options.fontDecorations.responsive) {
          container.style.maxHeight = `${100 - top}%`;
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

        const { currentUser } = options._context;
        if (currentUser && currentUser.features.clickToPhoneCall
          && currentUser.features.clickToPhoneCall.state === 'enabled') {
          const phoneMarkerIcon = document.createElement('span');
          phoneMarkerIcon.classList.add('fa');
          phoneMarkerIcon.classList.add('fa-phone');
          phoneMarkerIcon.setAttribute('title', 'This input supports phone numbers.');
          linkUrlDiv.appendChild(phoneMarkerIcon);
        }

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
            type: POPCORN_ELEMENT_TYPES.TEXT,
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
            type: POPCORN_ELEMENT_TYPES.TEXT,
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
            type: POPCORN_ELEMENT_TYPES.TEXT,
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
        draggableResizable(options, { draggable: false, resizable: true }, runTextfill);
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
          draggableResizable(options, { draggable: true, resizable: true }, runTextfill);
        }
        if (!shouldRunTextfill) {
          runTextfill();
        }
      });

      options._contentSpan = innerSpan;

      options._container.addEventListener('click', (event) => {
        event.stopPropagation();
        // const { currentUser } = options._context;
        if (!options.linkUrl) {
          linkUrlSpan.innerHTML = wrapTokens(options._natives.manifest.options.linkUrl.placeholder);
        }
        options._container.querySelector('*[contenteditable=""]').focus();
        context.emit('elementSelected', {
          element: options,
        });
      });

      const editTooltip = document.createElement('span');
      editTooltip.classList.add('edit-tooltip');
      editTooltip.classList.add('hidden');
      editTooltip.textContent = 'Double click to edit';

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

      draggableResizable(options, { draggable: true, resizable: true }, runTextfill);
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
        animation: options.animation,
      });
    },

    start(event, options) {
      if (!isSafari()) {
        const animationContainer = options._animationContainer;
        animationStart(options);

        if (options.fontDecorations.responsive) {
          // perform textfill
          (() => {
            const resizeOptions = {
              innerTag: 'span',
              maxFontPixels: -1,
              explicitWidth: animationContainer.clientWidth,
              explicitHeight: animationContainer.clientHeight,
            };
            jQuery(animationContainer.childNodes[0].childNodes[0]).textfill(resizeOptions);
          })();
        }

        buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
          options.scripts._compiled.onStart();
        }
      } else {
        setTimeout(() => {
          animationStart(options);

          // perform textfill
          (() => {
            const resizeOptions = {
              innerTag: 'span',
              maxFontPixels: -1,
              explicitWidth: options._animationContainer.clientWidth,
              explicitHeight: options._animationContainer.clientHeight,
            };
            jQuery(options._animationContainer.childNodes[0].childNodes[0]).textfill(resizeOptions);
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

    _update(trackEvent, options) {
      if (options.start && options.start !== trackEvent.start) {
        trackEvent.start = options.start;
      }
      if (options.end && options.end !== trackEvent.end) {
        trackEvent.end = options.end;
      }

      if (options.animation) {
        updateIn(trackEvent, options);

        updateIdle(trackEvent, options);

        updateOut(trackEvent, options);
      }

      function runTextfill() {
        if (!trackEvent.fontDecorations.responsive) {
          return;
        }
        const alignTokenHelpers = () => {
          const fontSize = +trackEvent._animationContainer.firstChild.firstChild.querySelector('span').style.fontSize.slice(0, -2);
          trackEvent._animationContainer.firstChild.firstChild.querySelectorAll('.token-uppercase').forEach((element) => {
            element.style.height = `${fontSize + 4}px`;
          });
          trackEvent._animationContainer.firstChild.firstChild.querySelectorAll('.token-default').forEach((element) => {
            element.style.height = `${fontSize + 4}px`;
          });
        };
        const resizeOptions = {
          innerTag: 'span',
          maxFontPixels: -1,
          explicitWidth: trackEvent._animationContainer.clientWidth,
          explicitHeight: trackEvent._animationContainer.clientHeight,
        };

        alignTokenHelpers();
        jQuery(trackEvent._animationContainer.firstChild.firstChild).textfill(resizeOptions);
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
        };
        document.head.appendChild(fontSheet);
        fontSheet.href = `https://fonts.googleapis.com/css?family=${options.fontFamily.replace(/\s/g, '+')}:400,700`;
      } else if (options.fontDecorations && options.fontDecorations.responsive) {
        if (trackEvent.fontDecorations.responsive) {
          /*
            wait for the elements to be rendered using their fonts
          */

          setTimeout(runTextfill, 30);

          jQuery(window).resize(() => {
            if (trackEvent.resizeTimer) {
              clearTimeout(trackEvent.resizeTimer);
            }
            trackEvent.resizeTimer = setTimeout(runTextfill, 30);
          });
        }
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
        trackEvent._container.zIndex = trackEvent.zindex;
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

        if (!linkUrlDiv.querySelector('.fa-phone')) {
          const { currentUser } = trackEvent._context;
          if (currentUser && currentUser.features.clickToPhoneCall
            && currentUser.features.clickToPhoneCall.state === 'enabled') {
            const phoneMarkerIcon = document.createElement('span');
            phoneMarkerIcon.classList.add('fa');
            phoneMarkerIcon.classList.add('fa-phone');
            phoneMarkerIcon.setAttribute('title', 'This input supports phone numbers.');
            linkUrlDiv.appendChild(phoneMarkerIcon);
          }
        }

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
              type: POPCORN_ELEMENT_TYPES.TEXT,
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
            type: POPCORN_ELEMENT_TYPES.TEXT,
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
            type: POPCORN_ELEMENT_TYPES.TEXT,
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
        draggableResizable(trackEvent, { draggable: false, resizable: true }, runTextfill);
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
          draggableResizable(trackEvent, { draggable: true, resizable: true }, runTextfill);
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
        trackEvent._animationContainer.firstChild.firstChild
          .querySelectorAll('.token-uppercase').forEach((element) => {
            element.style.height = getAbsoluteStyleDimension(element, 'fontSize');
          });
        trackEvent._animationContainer.firstChild.firstChild
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
      } else {
        trackEvent._container.style.backgroundColor = '';
      }

      if (trackEvent.shadow) {
        trackEvent._container.firstChild.style.textShadow = `0 1px 5px ${trackEvent.shadowColor}, 0 1px 10px ${trackEvent.shadowColor}`;
      } else {
        trackEvent._container.firstChild.style.textShadow = '';
      }

      const checkIfWebKit = /WebKit/.test(navigator.userAgent);

      if (trackEvent.stroke) {
        if (checkIfWebKit) {
          trackEvent._container.firstChild.style.webkitTextStroke = `${trackEvent.fontSize * 0.2}px ${trackEvent.strokeColor}`;
        } else {
          trackEvent._container.firstChild.style.textShadow = `-${trackEvent.fontSize * 0.2}px -${trackEvent.fontSize * 0.2}px 0 ${trackEvent.strokeColor}, ${trackEvent.fontSize * 0.2}px -${trackEvent.fontSize * 0.2}px 0 ${trackEvent.strokeColor}, -${trackEvent.fontSize * 0.2}px ${trackEvent.fontSize * 0.2}px 0 ${trackEvent.strokeColor}, ${trackEvent.fontSize * 0.2}px ${trackEvent.fontSize * 0.2}px 0 ${trackEvent.strokeColor}`;
        }
      } else if (checkIfWebKit) {
        trackEvent._container.firstChild.style.webkitTextStroke = '';
      } else {
        trackEvent._container.firstChild.style.textShadow = '';
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
      const defaultAlignmentClass = trackEvent._natives.manifest.options.alignment.default;
      trackEvent._container.firstChild.firstChild.style['justify-content'] = flexAlignment;
      trackEvent._container.firstChild.firstChild.classList.remove(defaultAlignmentClass);
      trackEvent._container.firstChild.firstChild.classList.add(textAlignment);

      draggableResizable(trackEvent, { draggable: true, resizable: true }, runTextfill);
    },

    end(event, options) {
      if (!isSafari()) {
        animationEnd(options);

        buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
          options.scripts._compiled.onEnd();
        }
      } else {
        setTimeout(() => {
          animationEnd(options);
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
