import {
  animations,
  ANIMATION_TYPES,
  ANIMATED_CLASS,
  INFINITE_CLASS,
  NONE_CLASS,
} from '../constants/animations';
import { removeClass, addClass, on, off } from './popcorn-helper';

const animationValuesIn = animations[ANIMATION_TYPES.IN].map(item => item.value);
const animationValuesOut = animations[ANIMATION_TYPES.OUT].map(item => item.value);

const removeAnimation = (container, options, animationType) => {
  if (options.animation[animationType]) {
    removeClass(container, options.animation[animationType].type);
  }
};

export const animationStart = (options) => {
  const { _container: animationContainer } = options;
  if (!animationContainer) {
    return;
  }
  removeAnimation(animationContainer, options, ANIMATION_TYPES.IDLE);
  removeAnimation(animationContainer, options, ANIMATION_TYPES.OUT);
  on(animationContainer);

  if (options.animation.in && options.animation.in.type !== NONE_CLASS) {
    removeClass(animationContainer, INFINITE_CLASS);

    addClass(animationContainer, ANIMATED_CLASS);
    addClass(animationContainer, options.animation.in.type);

    animationContainer.addEventListener('animationend', (e) => {
      const { animationName } = e;
      if (animationValuesIn.includes(animationName)) {
        animationContainer.classList.remove(options.animation.in.type);
        if (options.animation.idle) {
          addClass(animationContainer, options.animation.idle.type);
          animationContainer.classList.add(INFINITE_CLASS);
        }
      }
    });
  } else if (options.animation.idle && options.animation.idle.type !== NONE_CLASS) {
    addClass(animationContainer, INFINITE_CLASS);
    addClass(animationContainer, ANIMATED_CLASS);
    addClass(animationContainer, options.animation.idle.type);
  }
};

export const animationEnd = (options) => {
  const { _container: animationContainer } = options;
  if (!animationContainer) {
    return;
  }

  if (options.animation.out && options.animation.out.type !== NONE_CLASS) {
    removeAnimation(animationContainer, options, ANIMATION_TYPES.IN);
    removeAnimation(animationContainer, options, ANIMATION_TYPES.IDLE);

    removeClass(animationContainer, INFINITE_CLASS);
    addClass(animationContainer, ANIMATED_CLASS);

    animationContainer.classList.add(options.animation.out.type);

    animationContainer.addEventListener('animationend', (e) => {
      const { animationName } = e;
      if (animationValuesOut.includes(animationName)) {
        animationContainer.classList.remove(options.animation.out.type);
        if (options.animation.idle) {
          addClass(animationContainer, options.animation.idle.type);
          animationContainer.classList.add(INFINITE_CLASS);
        }
        off(animationContainer);
      }
    });
  } else {
    off(animationContainer);
  }
};

export const updateIn = (trackEvent, options) => {
  if (options.animation.in) {
    if (trackEvent.animation.in && trackEvent.animation.in.type === options.animation.in.type) {
      return;
    }
    const { _container: container } = trackEvent;
    removeAnimation(container, trackEvent, ANIMATION_TYPES.IN);
    removeAnimation(container, trackEvent, ANIMATION_TYPES.IDLE);

    addClass(container, ANIMATED_CLASS);
    removeClass(container, INFINITE_CLASS);

    container.classList.add(options.animation.in.type);

    container.addEventListener('animationend', (e) => {
      const { animationName } = e;
      if (animationValuesIn.includes(animationName)) {
        container.classList.remove(animationName);
        container.classList.remove(options.animation.in.type);
        if (trackEvent.animation.idle) {
          container.classList.add(INFINITE_CLASS);
          container.classList.add(trackEvent.animation.idle.type);
        }
      }
    });
    trackEvent.animation = trackEvent.animation
      ? { ...trackEvent.animation, in: options.animation.in }
      : { in: options.animation.in };
  }
};

export const updateIdle = (trackEvent, options) => {
  if (options.animation.idle) {
    if (trackEvent.animation.idle
      && trackEvent.animation.idle.type === options.animation.idle.type) {
      return;
    }
    const { _container: container } = trackEvent;
    addClass(container, ANIMATED_CLASS);
    addClass(container, INFINITE_CLASS);

    removeAnimation(container, trackEvent, ANIMATION_TYPES.IDLE);

    container.classList.add(options.animation.idle.type);
    trackEvent.animation = trackEvent.animation
      ? { ...trackEvent.animation, idle: options.animation.idle }
      : { idle: options.animation.idle };
  }
};

export const updateOut = (trackEvent, options) => {
  if (options.animation.out) {
    if (trackEvent.animation.out && trackEvent.animation.out.type === options.animation.out.type) {
      return;
    }
    const { _container: container } = trackEvent;
    removeClass(container, INFINITE_CLASS);
    addClass(container, ANIMATED_CLASS);
    removeAnimation(container, trackEvent, ANIMATION_TYPES.OUT);
    removeAnimation(container, trackEvent, ANIMATION_TYPES.IDLE);

    container.classList.add(options.animation.out.type);

    container.addEventListener('animationend', (e) => {
      const { animationName } = e;
      if (animationValuesOut.includes(animationName)) {
        container.classList.remove(animationName);
        container.classList.remove(options.animation.out.type);
        if (trackEvent.animation.idle) {
          container.classList.add(INFINITE_CLASS);
          container.classList.add(trackEvent.animation.idle.type);
        }
      }
    });
    trackEvent.animation = trackEvent.animation
      ? { ...trackEvent.animation, out: options.animation.out }
      : { out: options.animation.out };
  }
};
