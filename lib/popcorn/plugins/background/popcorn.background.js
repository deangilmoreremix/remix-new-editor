/* eslint-disable no-underscore-dangle,
no-new-func,no-useless-escape,no-tabs,no-cond-assign,prefer-destructuring */
// PLUGIN: background

import { on, off } from '../../helpers';
import {
  HEIGHT,
  WIDTH,
  TOP,
  LEFT,
  POPCORN_ELEMENT_TYPES,
  START,
  END,
  BACKGROUND,
  ZINDEX,
  BLEND_MODE,
  OPACITY,
  STYLES_FIELD,
} from '../../../constants/popcorn';
import {
  COLOR,
  INPUT_TEXTAREA,
  TIME,
} from '../../../constants/forms';
import {
  addDeleteListener,
  emitter,
  emitterActions,
  removeDeleteListener,
} from '../../../mitt/emitter';
import blendModeConstants from '../../../constants/blendMode';
import { addMouseDownEvent } from '../../../utils/popcorn-helper';

function parseCss(text, oneRule) {
  if (oneRule) {
    text = `.onerule{ ${text} }`;
  }
  const tokenizer = /([\s\S]+?)\{([\s\S]*?)\}/gi;
  const rules = [];
  let rule;
  let token;
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  while ((token = tokenizer.exec(text))) {
    const style = parseRule(token[2].trim());
    if (oneRule) {
      return style;
    }
    rule = {
      style,
    };

    rule.selectorText = token[1].trim().replace(/\s*\,\s*/, ', ');

    rules.push(rule);
  }
  return rules;
}


function parseRule(css) {
  const tokenizer = /\s*([a-z\-]+)\s*:\s*((?:[^;]*url\(.*?\)[^;]*|[^;]*)*)\s*(?:;|$)/gi;
  const obj = {};
  let token;
  while ((token = tokenizer.exec(css))) {
    obj[token[1].toLowerCase()] = token[2];
  }
  return obj;
}

function capitalizeCssRule(name) {
  return (name.replace(/(-)(\S)/g, s => s.toUpperCase())).replace(/-/g, '');
}

function setStyles(options, container, oneRule) {
  const styles = parseCss(options.styles, oneRule);
  Object.keys(styles).forEach(key => {
    const ruleName = (key.indexOf('-') === -1) ? key : capitalizeCssRule(key);
    options[ruleName] = styles[key];
    container.style[ruleName] = styles[key];
  });
}

((Popcorn) => {
  const DEFAULT_BACKGROUND_COLOR = '#888888';

  function getDefaultOptionValue(key) {
    const { options } = Popcorn.manifest[POPCORN_ELEMENT_TYPES.BACKGROUND];
    if (options && options[key]) {
      return options[key].default;
    }
    return null;
  }

  Popcorn.plugin(POPCORN_ELEMENT_TYPES.BACKGROUND, {

    manifest: {
      about: {
        name: 'Popcorn Background Plugin',
        version: '0.1',
        author: 'yur1y',
      },
      options: {
        [BLEND_MODE]: {
          default: blendModeConstants.normal.value,
          hidden: true,
        },
        [OPACITY]: {
          default: 100,
          hidden: true,
        },
        [START]: {
          name: START,
          type: TIME,
          label: 'Start',
          default: 0,
          className: 'input-background-time',
        },
        [END]: {
          name: END,
          type: TIME,
          label: 'End',
          default: 5,
          className: 'input-background-time',
        },
        [BACKGROUND]: {
          name: BACKGROUND,
          type: COLOR,
          label: 'Background color',
          default: DEFAULT_BACKGROUND_COLOR,
          className: 'background-color',
        },
        [STYLES_FIELD]: {
          name: STYLES_FIELD,
          type: INPUT_TEXTAREA,
          label: 'Styles',
          placeholder: 'css styles',
          default: '',
          className: 'styles-field',
          rows: 10,
        },
        [LEFT]: {
          default: 0,
          hidden: true,
        },
        [TOP]: {
          default: 0,
          hidden: true,
        },
        [WIDTH]: {
          default: 100,
          hidden: true,
        },
        [HEIGHT]: {
          default: 100,
          hidden: true,
        },
        [ZINDEX]: {
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

      const context = this;

      options.left = toFillOptions(LEFT);
      options.height = toFillOptions(HEIGHT);
      options.width = toFillOptions(WIDTH);
      options.top = toFillOptions(TOP);
      options.zindex = toFillOptions(ZINDEX);
      options.background = toFillOptions(BACKGROUND);
      options.styles = toFillOptions(STYLES_FIELD);
      options._context = context;

      if (!target) {
        target = this.media.parentNode;
      }

      options._target = target;
      container.style.position = 'absolute';
      container.style.mixBlendMode = options[BLEND_MODE]
        || getDefaultOptionValue(BLEND_MODE);
      container.style.opacity = options[OPACITY] !== undefined
        ? `${options[OPACITY]}%` : `${getDefaultOptionValue(OPACITY)}%`;
      container.classList.add('popcorn-background');
      off(container);
      container.style.width = `${getDefaultOptionValue(WIDTH)}%`;
      container.style.height = `${getDefaultOptionValue(HEIGHT)}%`;
      container.style.top = `${getDefaultOptionValue(TOP)}%`;
      container.style.left = `${getDefaultOptionValue(LEFT)}%`;
      container.style.background = options.background || DEFAULT_BACKGROUND_COLOR;
      container.style.zIndex = +options.zindex;

      target.appendChild(container);

      options._container = container;
      options._container.setAttribute('tabIndex', -1);

      if (options.styles) {
        setStyles(options, container, true);
      }

      removeDeleteListener(options._container, options.id);
      addDeleteListener(options._container, options.id);

      addMouseDownEvent(options);

      emitter.on(emitterActions.SELECT, id => {
        const isSelected = id === options.id;
        if (options && options._container) {
          options._container.classList[isSelected ? 'add' : 'remove']('active');
        }
      });
    },

    start(event, options) {
      on(options._container);
    },

    _update(trackEvent, options) {
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

      if (options.blendMode !== undefined && options.blendMode !== trackEvent.blendMode) {
        trackEvent.blendMode = options.blendMode;
        trackEvent._container.style.mixBlendMode = trackEvent.blendMode;
      }

      if (options.opacity !== undefined && options.opacity !== trackEvent.opacity) {
        trackEvent.opacity = options.opacity;
        trackEvent._container.style.opacity = `${trackEvent.opacity}%`;
      }

      if (options.background !== undefined && options.background !== trackEvent.background) {
        trackEvent.background = options.background;
        trackEvent._container.style.background = options.background;
      }
      if (options.styles !== undefined
        && options.styles !== trackEvent.styles) {
        trackEvent.styles = options.styles;
        setStyles(options, trackEvent._container, true);
      }
      if (options.styles === '') {
        trackEvent.background = DEFAULT_BACKGROUND_COLOR;
        trackEvent._container.style.background = trackEvent.background;
      }
    },

    end(event, options) {
      off(options._container);
    },

    _teardown(options) {
      if (options._target) {
        options._target.removeChild(options._container);
      }
    },
  });
})(window.Popcorn, window.jQuery);
