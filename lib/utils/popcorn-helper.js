import lottie from 'lottie-web';
import jQuery from 'jquery';

import { loadUrl } from '../requestCreator';
import { getColors, setColors } from '../lottie/utils';
import { COUNT_FRAMES_IN, COUNT_FRAMES_OUT } from '../constants/settings/json-transition';
import { BLEND_MODE, HEIGHT, LEFT, OPACITY, POPCORN_ELEMENT_TYPES, TOP, WIDTH, ZINDEX } from '../constants/popcorn';
import { isValidJsonUrl } from '../popcorn/helpers';
import { selectItem } from '../mitt/emitter';

export const addClass = (container, className) => {
  if (!container.classList.contains(className)) {
    container.classList.add(className);
  }
};

export const addClasses = (container, classNames) => {
  classNames.forEach(className => addClass(container, className));
};

export const removeClasses = (container, classNames) => {
  classNames.forEach(className => removeClass(container, className));
};
export const removeClass = (container, className) => {
  if (container.classList.contains(className)) {
    container.classList.remove(className);
  }
};

export const on = (container) => {
  container.classList.add('on');
  container.classList.remove('off');
};

export const off = (container) => {
  container.classList.remove('on');
  container.classList.add('off');
};

export const updateTrackEvent = (fieldList = [], trackEvent, options) => {
  fieldList.forEach(field => {
    if (options[field] !== undefined && options[field] !== trackEvent[field]) {
      trackEvent[field] = options[field];
    }
  });
  return trackEvent;
};

export const timeInRange = ({ start, end, time }) => time >= start && time <= end;

export const setLottieListeners = (options) => {
  options.animation.removeEventListener('enterFrame', () => setIdleState(options));
  options.animation.addEventListener('enterFrame', () => setIdleState(options));
};

export const initializeLottie = async (trackEvent, neeedListeners = true) => {
  const { url, colors } = trackEvent;
  if (!url || !isValidJsonUrl(url)) {
    return;
  }
  const animData = await loadUrl(url);
  trackEvent.animData = animData;

  if (colors && colors.length) {
    setColors(animData, colors);
  }

  if (trackEvent.animation && trackEvent.animation.destroy) {
    trackEvent.animation.destroy();
  }

  trackEvent.animation = lottie.loadAnimation({
    name: trackEvent.id,
    // eslint-disable-next-line no-underscore-dangle
    container: trackEvent._container,
    animationData: animData,
    loop: false,
    autoplay: false,
  });

  if (neeedListeners) {
    setLottieListeners(trackEvent);
  }
};

export const setIdleState = (options) => {
  const { animation } = options;
  if (animation) {
    const endFrame = animation.totalFrames - (COUNT_FRAMES_OUT);
    if (
      (!animation.isPaused || animation.currentFrame !== endFrame)
      && animation.currentFrame > COUNT_FRAMES_IN
      && animation.currentFrame < endFrame
    ) {
      animation.goToAndStop(endFrame, true);
    }
  }
};

export const setAnimationColors = (options) => {
  options.colors = [];
  const { animData } = options;
  if (animData && animData.layers) {
    getColors(animData.layers, color => options.colors.push(color));
  }

  if (animData && animData.assets) {
    animData.assets.forEach((asset, i) => getColors(
      asset.layers,
      color => options.colors.push(color), i),
    );
  }
};

export const getDefaultOptionValue = (key, manifest) => {
  const { options } = manifest;
  if (options && options[key]) {
    return options[key].default;
  }
  return null;
};

export const generatePopcornObject = (projectData) => {
  let popcornObject = {};

  const currentMedia = projectData.media[0];
  // We expect a string (one url) or an array of url strings.
  // Turn a single url into an array of 1 string.
  const mediaUrls = typeof currentMedia.url === 'string' ? [currentMedia.url] : currentMedia.url;

  const mediaUrlsString = `[ '${mediaUrls.join('', '')}' ]`;

  const mediaPopcornOptions = currentMedia.popcornOptions || {};
  // Force the Popcorn instance we generate to have an ID we can query.
  mediaPopcornOptions.id = 'Butter-Generated';

  const popcornData = {
    target: currentMedia.target,
    mediaUrlsString,
    // mediaPopcornOptions: mediaPopcornOptions,
    elements: [],
  };

  currentMedia.tracks.forEach((currentTrack) => {
    currentTrack.trackEvents.forEach((currentTrackEvent) => {
      popcornData.elements.push({
        type: currentTrackEvent.type,
        popcornOptions: currentTrackEvent.popcornOptions,
      });
    });
  });
  popcornObject = popcornData;

  return popcornObject;
};

export const addMouseDownEvent = (options = {}) => {
  const { _container: container } = options;
  if (!container) {
    return;
  }
  container.addEventListener('mousedown', (event) => {
    event.stopPropagation();
    selectItem(event, options.id);
  });
};

export const setJsonContainer = (options, Popcorn) => {
  const container = document.createElement('div');
  const manifest = Popcorn.manifest[POPCORN_ELEMENT_TYPES.JSON_TRANSITION];

  container.style.position = 'absolute';
  container.style.left = `${getDefaultOptionValue(LEFT, manifest)}%`;
  container.style.top = `${getDefaultOptionValue(TOP, manifest)}%`;
  container.style.width = `${getDefaultOptionValue(WIDTH, manifest)}%`;
  container.style.height = `${getDefaultOptionValue(HEIGHT, manifest)}%`;
  container.style.zIndex = options.zindex || getDefaultOptionValue(ZINDEX, manifest);

  container.classList.add('popcorn-json-animation');
  container.setAttribute('id', options.id);
  container.setAttribute('tabIndex', -1);

  // eslint-disable-next-line no-underscore-dangle
  options._container = container;

  // eslint-disable-next-line no-underscore-dangle
  options._container.style.mixBlendMode = options[BLEND_MODE]
    || getDefaultOptionValue(BLEND_MODE, manifest);
  // eslint-disable-next-line no-underscore-dangle
  options._container.style.opacity = options[OPACITY]
    || getDefaultOptionValue(OPACITY, manifest);
};

const alignTokenHelpers = (container) => {
  const fontSize = container.querySelector('span').style.fontSize.slice(0, -2);
  container.querySelectorAll('.token-uppercase').forEach((element) => {
    element.style.height = `${fontSize + 4}px`;
  });
  container.querySelectorAll('.token-default').forEach((element) => {
    element.style.height = `${fontSize + 4}px`;
  });
};

export const runTextfill = (trackEvent) => {
  if (!trackEvent.fontDecorations.responsive) {
    return;
  }
  const { _container: container } = trackEvent;
  const resizeOptions = {
    innerTag: 'span',
    maxFontPixels: -1,
  };

  const element = container.firstChild.firstChild;

  alignTokenHelpers(element);
  jQuery(element).textfill(resizeOptions);
  // re-run to set correct size for token
  alignTokenHelpers(element);
};
