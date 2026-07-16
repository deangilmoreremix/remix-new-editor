// PLUGIN: Seethroughtext
/* eslint-disable no-underscore-dangle,no-new-func, no-multi-assign */

import {
  BACKGROUND_COLOR,
  BOLD,
  END,
  FIELD_TEXT,
  FONT_DECORATIONS,
  FONT_FAMILY,
  HTML_FIELD_TEXT,
  POPCORN_ELEMENT_TYPES,
  START,
} from '../../../constants/popcorn';
import { CHECKBOX, COLOR, CONTENTEDITABLE_TEXTAREA, MULTILINE, SELECT, TIME } from '../../../constants/forms';
import { CARET_FIELDS } from '../../../constants/tokens';
import fonts from '../../../constants/fonts';
import { addDeleteListener, removeDeleteListener } from '../../../mitt/emitter';
import { wrapSvgTokens } from '../../../utils/tokens-helper';
import { addMouseDownEvent } from '../../../utils/popcorn-helper';

import { extendObservable } from 'mobx';

const text = {
  name: FIELD_TEXT,
  default: 'Video',
  hidden: true,
};

const italicSpecialFonts = ['Mr Dafoe', 'Aguafina Script', 'Great Vibes'];

const isFontPresent = (font) => italicSpecialFonts.some(el => el === font);

const selectFonts = [];
fonts.map(item => (selectFonts.push({ label: item, value: item })));

((Popcorn) => {
  const DEFAULT_BACKGROUND = '#000000';
  const DEFAULT_FONT_SIZE = 10;
  const DEFAULT_FONT = 'Bowlby One SC';
  const DEFAULT_OPACITY = 100;
  const FONT_HREF = 'https://fonts.googleapis.com/css?family=';

  const buildScripts = options => {
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
  };

  const textfillSvg = options => {
    let fontSize = 20;
    const outer = options._container;
    const svgText = outer.getElementsByTagName('text')[0];
    const isSpecialFont = isFontPresent(options.fontFamily);

    if (svgText) {
      outer.style.font = `${options.fontDecorations} ${fontSize}em '${options.fontFamily}'`;
      let textDimensions = svgText.getBBox().width;
      let textHeight = svgText.getBBox().height;
      do {
        fontSize -= isSpecialFont ? 1 : 0.5;
        textDimensions = svgText.getBBox().width;
        textHeight = svgText.getBBox().height;
        outer.style.font = `${options.fontDecorations} ${fontSize}em '${options.fontFamily}'`;
      } while ((textDimensions > outer.clientWidth
        || textHeight > outer.clientHeight)
      && (options.text.length > 0) && (fontSize > 1));
    }
  };

  const createText = (parent, options) => {
    const outer = document.createElement('div');
    outer.style.fontFamily = options.fontFamily;
    Object.assign(outer.style, {
      width: '100%',
      height: '100%',
    });

    let bgcolor = DEFAULT_BACKGROUND;
    if (options.backgroundColor) {
      bgcolor = options.backgroundColor;
    }

    const hex = bgcolor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    bgcolor = `rgba(${r},${g},${b},100)`;

    outer.innerHTML = `${'<svg class="knockout__svg" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">'
      + '<mask id="text-clip-'}${options.id}">`
      + '<rect id="bg" width="100%" height="100%" fill="white"/>'
      + `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#000">${options.htmlText}</text>`
      + '</mask>'
      + `<rect width="100%" height="100%" style="fill: ${bgcolor};" mask="url(#text-clip-${options.id})"/>`
      + '</svg>';

    parent.appendChild(outer);

    // align size of element after building DOM to get real dimensions
    setTimeout(() => {
      textfillSvg(options);
    }, 100);
  };

  const fontExist = fontFamily => {
    const fontWithOutSpace = fontFamily.replace(/\s/g, '+');
    const links = document.querySelectorAll('link');
    let isPresent = false;
    links.forEach(link => {
      if (isPresent) {
        return;
      }
      if (link.href === `${FONT_HREF}${fontWithOutSpace}`) {
        isPresent = true;
      }
    });
    return isPresent;
  };

  Popcorn.plugin(POPCORN_ELEMENT_TYPES.TEXT_MASK, {
    manifest: {
      about: {
        name: 'Popcorn Maker See-through text Plugin',
        varsion: '0.1',
        author: 'Arnel Celedonio @digistrats',
        website: 'http://digistrats.com',
      },
      options: {
        text,
        [HTML_FIELD_TEXT]: {
          name: HTML_FIELD_TEXT,
          type: CONTENTEDITABLE_TEXTAREA,
          label: 'Text',
          variant: MULTILINE,
          default: wrapSvgTokens(text.default),
          additionalFieldName: FIELD_TEXT,
          caretName: CARET_FIELDS[HTML_FIELD_TEXT],
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
        [FONT_FAMILY]: {
          name: FONT_FAMILY,
          items: selectFonts,
          type: SELECT,
          label: 'Font',
          default: DEFAULT_FONT,
        },
        [BACKGROUND_COLOR]: {
          name: BACKGROUND_COLOR,
          type: COLOR,
          label: 'Background color',
          default: DEFAULT_BACKGROUND,
        },
        [FONT_DECORATIONS]: {
          name: FONT_DECORATIONS,
          [BOLD]: {
            name: BOLD,
            label: 'Bold',
            type: CHECKBOX,
          },
          default: { [BOLD]: false },
        },
      },
    },
    _setup(options) {
      const toFillOptions = field => {
        if (options[field] !== undefined) {
          return options[field];
        } else {
          return options._natives.manifest.options[field].default;
        }
      };
      let target = Popcorn.dom.find(options.target);
      const container = document.createElement('div');
      const context = this;
      let fontSheet;
      const fontDecorations = toFillOptions(FONT_DECORATIONS);
      const innerDivCanvas = document.createElement('div');
      innerDivCanvas.classList.add('inner-canvas');
      innerDivCanvas.style.fontFamily = toFillOptions(FONT_FAMILY);


      container.style.position = innerDivCanvas.style.position = 'absolute';
      container.style.width = innerDivCanvas.style.width = '100%';
      container.style.top = innerDivCanvas.style.top = '0';
      container.style.left = innerDivCanvas.style.left = '0';
      container.style.height = innerDivCanvas.style.height = '100%';
      container.style.zIndex = innerDivCanvas.style.zIndex = options.zindex;
      container.style.opacity = options.opacity !== undefined ? `${options.opacity}%` : '100%';
      container.setAttribute('tabIndex', -1);
      target.appendChild(container);
      container.appendChild(innerDivCanvas);
      options._container = container;
      container.classList.add('popcorn-see-through-text');
      container.classList.add('off');

      removeDeleteListener(container, options.id);
      addDeleteListener(container, options.id);

      addMouseDownEvent(options);

      if (!target) {
        target = context.media.parentNode;
      }

      options.text = toFillOptions(FIELD_TEXT);
      options.fontFamily = toFillOptions(FONT_FAMILY);
      options.backgroundColor = toFillOptions(BACKGROUND_COLOR);
      options.opacity = options.opacity || DEFAULT_OPACITY;
      options.htmlText = wrapSvgTokens(options.text);
      options._target = target;

      if (!fontExist(options.fontFamily)) {
        fontSheet = document.createElement('link');
        fontSheet.rel = 'stylesheet';
        fontSheet.type = 'text/css';
        fontSheet.href = `https://fonts.googleapis.com/css?family=${options.fontFamily.replace(/\s/g, '+')}`;
        document.head.appendChild(fontSheet);
        // Store reference to generated sheet for removal later, remove any existing ones
        options._fontSheet = fontSheet;
      }

      options.toString = () => toFillOptions(FIELD_TEXT);
      options.fontDecorations = fontDecorations.bold === true ? 'bold' : 'normal';
      options.fontSize = options.fontSize ? options.fontSize : DEFAULT_FONT_SIZE;

      container.style.fontFamily = toFillOptions(FONT_FAMILY);
      createText(innerDivCanvas, options);


      setTimeout(() => {
        textfillSvg(options);
      }, 100);
      buildScripts(options);

      extendObservable(options, {
        fontFamily: options.fontFamily,
        fontSize: options.fontSize,
        fontDecorations: options.fontDecorations,
        backgroundColor: options.backgroundColor,
        backgroundTransparent: options.backgroundTransparent,
        text: options.text,
        htmlText: options.htmlText,
      });
    },
    start(event, options) {
      const container = options._container;

      if (container) {
        container.classList.add('on');
        container.classList.remove('off');
      }
      textfillSvg(options);
      buildScripts(options);
      if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
        options.scripts._compiled.onStart();
      }
    },
    end(event, options) {
      if (options._container) {
        options._container.classList.add('off');
        options._container.classList.remove('on');
      }

      buildScripts(options);
      if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
        options.scripts._compiled.onEnd();
      }
    },
    _update(trackEvent, options) {
      if (options.newSize) {
        textfillSvg(trackEvent);
      }

      if (options.backgroundColor !== undefined
        && options.backgroundColor !== trackEvent.backgroundColor) {
        trackEvent.backgroundColor = options.backgroundColor;
      }

      if (options.fontDecorations && options.fontDecorations !== trackEvent.fontDecorations) {
        trackEvent._container.style.fontWeight = options.fontDecorations.bold ? 'bold' : 'normal';
        trackEvent.fontDecorations = options.fontDecorations.bold ? 'bold' : 'normal';
      }

      if (options.fontFamily !== undefined && options.fontFamily !== trackEvent.fontFamily) {
        trackEvent.fontFamily = options.fontFamily;

        if (!fontExist(options.fontFamily)) {
          const fontSheet = document.createElement('link');
          fontSheet.rel = 'stylesheet';
          fontSheet.type = 'text/css';
          trackEvent.fontFamily = trackEvent.fontFamily
            ? trackEvent.fontFamily
            : trackEvent._natives.manifest.options.fontFamily.default;
          // Store reference to generated sheet for removal later, remove any existing ones
          trackEvent._fontSheet = fontSheet;

          fontSheet.onload = () => {
            trackEvent._container.style.fontFamily = `'${options.fontFamily}'`;
          };
          fontSheet.href = `https://fonts.googleapis.com/css?family=${options.fontFamily.replace(/\s/g, '+')}`;
          document.head.appendChild(fontSheet);
        }
      }

      if (options.text !== undefined && options.text !== trackEvent.text) {
        trackEvent.text = options.text;
      }
      if (options.htmlText !== undefined && options.htmlText !== trackEvent.htmlText) {
        trackEvent.htmlText = options.htmlText;
      }
      if (options.opacity !== undefined && options.opacity !== trackEvent.opacity) {
        trackEvent.opacity = options.opacity;
        trackEvent._container.style.opacity = `${trackEvent.opacity}%`;
      }

      if (trackEvent) {
        const innerCanvas = trackEvent._container.querySelector('.inner-canvas');
        const innerDiv = innerCanvas.querySelector('div');
        if (innerDiv) {
          innerCanvas.removeChild(innerDiv);
          createText(innerCanvas, trackEvent);
        }
      }
    },
    _teardown(options) {
      if (options._container && options._target) {
        options._target.removeChild(options._container);
      }

      if (options._fontSheet) {
        document.head.removeChild(options._fontSheet);
      }
    },
  });
})(window.Popcorn);
