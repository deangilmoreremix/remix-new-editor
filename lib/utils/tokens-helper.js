import {
  tokenModes,
  TOKEN_REGEX,
  TOKEN_HELPER_CLASSES,
  OPEN_PERSONALIZATION_TAG,
  CLOSE_PERSONALIZATION_TAG,
  OPEN_PERSONALIZATION_TAG_SVG,
  CLOSE_PERSONALIZATION_TAG_SVG,
} from '../constants/tokens';
import { EMAIL_SKIP_TOKENS } from '../constants/campaigns/constants';
import svgIconDefault from '../../public/static/svgImages/tokens/default.svg';
import svgIconUppercase from '../../public/static/svgImages/tokens/uppercase.svg';
import emailProvider from '../constants/campaigns/email-providers';

export const prettyPrintTokens = (string) => {
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
};

export const wrapTokens = (string) => {
  if (!string) {
    return '';
  }

  return string.replace(TOKEN_REGEX, (match) => {
    match = match.replace(/({{|}})/gm, '');
    let result = OPEN_PERSONALIZATION_TAG;
    if (match.split(' ').length > 1) {
      const [helper, tokenName, ...params] = match.split(' ');
      if (helper && helper !== 'token-none') {
        if (TOKEN_HELPER_CLASSES[helper] === 'token-default') {
          result += svgIconDefault;
        } else {
          result += svgIconUppercase;
        }
      }
      result += `<span class="${TOKEN_HELPER_CLASSES[helper]}" data-parameter="${encodeURIComponent(JSON.stringify(params.map(param => param.substr(1, param.length - 2))))}"></span>`;
      result += tokenName;
    } else {
      result += '<span class="token-none" data-parameter=""></span>';
      result += match;
    }
    result += CLOSE_PERSONALIZATION_TAG;
    return result;
  });
};

export const unwrapTokens = (string) => {
  if (!string) {
    return '';
  }
  const tokenRegexPattern = `(${OPEN_PERSONALIZATION_TAG}|${OPEN_PERSONALIZATION_TAG_SVG})?(<svg class="([^{}="<>]*)" xmlns="([^{}="<>]*)" viewBox="([^{}="<>]*)">?(.*?)</svg>)?(<(span|tspan) class="(token-default|token-uppercase|token-none)" data-parameter="([^="<>]*)"( style="[^="<>]*")?></(span|tspan)>)?([^{}="<>]*)(${CLOSE_PERSONALIZATION_TAG}|${CLOSE_PERSONALIZATION_TAG_SVG})`;
  const smartTokenRegex = new RegExp(tokenRegexPattern, 'gm');
  return string.replace(smartTokenRegex, (match) => {
    // to reset regexp pointer, let's use new regexp instance
    const [, , , , , , , , , helper, params, , , token] = new RegExp(tokenRegexPattern, 'gm').exec(match);
    if (helper && helper !== 'token-none') {
      const [tokenHelper] = Object
        .entries(TOKEN_HELPER_CLASSES)
        .find(([, value]) => value === helper);
      const parsedParams = params && JSON.parse(decodeURIComponent(params)).map(elem => `"${elem}"`);
      return `{{${tokenHelper} ${token}${(parsedParams && parsedParams.length > 0) ? ` ${parsedParams.join('')}` : ''}}}`;
    } else {
      return `{{${token}}}`;
    }
  });
};

export const wrapSvgTokens = (string) => {
  if (!string) {
    return '';
  }

  return string.replace(TOKEN_REGEX, (match) => {
    match = match.replace(/({{|}})/gm, '');
    let result = OPEN_PERSONALIZATION_TAG_SVG;
    if (match.split(' ').length > 1) {
      const [helper, tokenName, ...params] = match.split(' ');
      if (helper && helper !== 'token-none') {
        if (TOKEN_HELPER_CLASSES[helper] === 'token-default') {
          result += svgIconDefault;
        } else {
          result += svgIconUppercase;
        }
      }
      result += `<tspan class="${TOKEN_HELPER_CLASSES[helper]}" data-parameter="${encodeURIComponent(JSON.stringify(params.map(param => param.substr(1, param.length - 2))))}"></tspan>`;
      result += tokenName;
    } else {
      result += '<tspan class="token-none" data-parameter=""></tspan>';
      result += match;
    }
    result += CLOSE_PERSONALIZATION_TAG_SVG;
    return result;
  });
};

const getTextLength = (parent, node, offset) => {
  let textLength = 0;
  if (!node) {
    return textLength;
  }
  if (node.nodeName === '#text') {
    textLength += offset;
  } else {
    for (let i = 0; i < offset; i++) {
      textLength += getNodeTextLength(node.childNodes[i]);
    }
  }

  if (node !== parent) {
    textLength += getTextLength(parent, node.parentNode, getNodeOffset(node));
  }
  return textLength;
};

const getHelper = (helper) => {
  const [tokenHelper] = Object
    .entries(TOKEN_HELPER_CLASSES)
    .find(([, value]) => value === helper);

  return tokenHelper;
};

const getNodeTextLength = (node) => {
  let textLength = 0;
  // break is one symbol
  const breakLength = 1;
  const bracesCount = 2;

  if (node.nodeName === 'BR') {
    textLength = breakLength;
  } else if (node.nodeName === '#text') {
    textLength = node.nodeValue.length;
  } else if (node.childNodes) {
    if (node.nodeName === 'SPAN') {
      // The brackets used to wrap tokens are taken into account here.
      textLength += bracesCount;
      if (node.classList.contains('token-uppercase') || node.classList.contains('token-default')) {
        textLength += (getHelper(node.classList[0])).length + 1;
        const param = node.dataset.parameter;
        const parsedParams = param && JSON.parse(decodeURIComponent(param)).map(elem => `'${elem}'`);
        const params = parsedParams && parsedParams.length > 0 ? ` ${parsedParams.join(' ')}` : '';
        textLength += params.length;
      }
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      textLength += getNodeTextLength(node.childNodes[i]);
    }
  }

  return textLength;
};

const getNodeOffset = (node) => (!node ? -1 : 1 + getNodeOffset(node.previousSibling));

export const catchCaretCharacterOffsetWithin = ({ currentTarget: element }) => {
  if (element.caretUpdated) {
    element.caretUpdated = false;
    return;
  }
  const doc = element.ownerDocument || element.document;
  const win = doc.defaultView || doc.parentWindow;
  let sel;
  let range;
  if (typeof win.getSelection !== 'undefined') {
    sel = win.getSelection();
    range = win.getSelection().getRangeAt(0);
  } else if (doc.selection && doc.selection.type !== 'Control') {
    sel = doc.selection;
    range = sel.createRange();
  }
  return getTextLength(element, range.endContainer, range.endOffset);
};

export const buildDefaultsSyntax = (varName, defaultValue) => `{{d ${varName} "${defaultValue.replace(/"/g, '\\"').replace(/{|}/g, '')}"}}`;


export const formatToken = (token, tokenState, fallbackValue) => {
  if (!token) {
    return;
  }
  const tokenName = token.trim().replace(/ /g, '');
  switch (tokenState) {
    case tokenModes.fallbackValue:
      return buildDefaultsSyntax(tokenName, fallbackValue);
    case tokenModes.uppercase:
      return `{{up ${tokenName}}}`;
    default:
      return `{{${tokenName}}}`;
  }
};

export const addToken = (text = '', token, caretPosition = 0) => {
  const front = (text).substring(0, caretPosition);
  const back = (text).substring(caretPosition, text.length);
  return front + token + back;
};

const processElement = (str, item) => {
  if (item.type === 'personalizedImage') {
    str = `${str} ${item.popcornOptions.src}`;
  }
  if (item.popcornOptions.text !== undefined) {
    str = `${str} ${item.popcornOptions.text.replace(/uppercase /g, '').replace(/up /g, '')}`;
    const regexVars = item.popcornOptions.text.match(/{{(.*?)}}/g);
    if (regexVars) {
      regexVars.forEach((regexVar) => {
        const regexMatches = regexVar.match(/'(.[^']*)'/);
        if (regexMatches) {
          str = `${str} {{${regexMatches[1]}}}`;
        }
      });
    }
  }

  return str;
};

const getCustomVarsFromStr = (str) => {
  const list = [];

  const matches = str.match(/{{(up \w*|d \w* "[^{}]*"|"\w*"|\w*)}}/g);

  if (matches !== null) {
    matches.forEach((x) => {
      const getMatch = x.match(/{{([^}]+)}}/);
      if (getMatch) {
        let key = getMatch[1];
        // if it's with helper - let's extract variable name
        if (key.split(' ').length > 1) {
          [, key] = key.split(' ');
        }
        if (list.indexOf(key) < 0) {
          list.push(key.toUpperCase());
        }
      }
    });
  }
  return list;
};


export const getCustomVarsFromMediaArr = (mediaArr) => {
  if (mediaArr && mediaArr.length > 0) {
    let str = '';
    mediaArr.forEach((currentMedia) => {
      currentMedia.tracks.forEach((tracks) => {
        tracks.trackEvents.forEach((element) => {
          str = processElement(str, element);
        });
      });
    });

    return getCustomVarsFromStr(str);
  } else {
    return [];
  }
};

export const openVideoUrl = (basicPath, personalizations) => {
  const tokens = personalizations.filter((token => !EMAIL_SKIP_TOKENS.includes(token)));
  const params = emailProvider || [];

  const queryParams = tokens.map(param => {
    const {
      token: { open, close },
      lookup, format,
    } = params.find(p => p.key === param || p.key === 'custom');

    let formattedParam;

    if (lookup && param in lookup) {
      formattedParam = lookup[param];
    } else if (format) {
      formattedParam = format(param);
    } else {
      formattedParam = param;
    }
    return `${param}=${open}${formattedParam}${close}`;
  });

  return `${basicPath}${queryParams.length ? `?${queryParams.join('&')}` : ''}`;
};
