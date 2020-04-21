import { animations, ANIMATION_TYPES, ANIMATED_CLASS, INFINITE_CLASS } from '../constants/animations';
import { removeClass, addClass, on, off } from './popcorn-helper';

const animationValuesIn = animations[ANIMATION_TYPES.IN].map(item => item.value);
const animationValuesOut = animations[ANIMATION_TYPES.OUT].map(item => item.value);

const removeAnimation = (container, options, animationType) => {
  if (options.animation[animationType]) {
    removeClass(container, options.animation[animationType].type);
  }
};

export const animationStart = (options) => {
  const { _animationContainer: animationContainer } = options;
  if (!animationContainer) {
    return;
  }
  on(animationContainer);

  if (options.animation.in) {
    removeAnimation(animationContainer, options, ANIMATION_TYPES.IDLE);
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
  }
};

export const animationEnd = (options) => {
  const { _animationContainer: animationContainer } = options;
  if (!animationContainer) {
    return;
  }
  if (options.animation.out) {
    removeAnimation(animationContainer, options, ANIMATION_TYPES.IN);
    removeAnimation(animationContainer, options, ANIMATION_TYPES.IDLE);

    removeClass(animationContainer, INFINITE_CLASS);

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
    const { _animationContainer: container } = trackEvent;
    removeAnimation(container, trackEvent, ANIMATION_TYPES.IN);

    addClass(container, ANIMATED_CLASS);
    removeClass(container, INFINITE_CLASS);

    container.classList.add(options.animation.in.type);

    container.addEventListener('animationend', (e) => {
      const { animationName } = e;
      if (animationValuesIn.includes(animationName)) {
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
    const { _animationContainer: container } = trackEvent;
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
    const { _animationContainer: container } = trackEvent;
    removeClass(container, INFINITE_CLASS);
    addClass(container, ANIMATED_CLASS);
    removeAnimation(container, trackEvent, ANIMATION_TYPES.OUT);

    container.classList.add(options.animation.out.type);

    container.addEventListener('animationend', (e) => {
      const { animationName } = e;
      if (animationValuesOut.includes(animationName)) {
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
