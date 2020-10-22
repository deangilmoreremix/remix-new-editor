import {
  animations,
  ANIMATION_TYPES,
  ANIMATED_CLASS,
  INFINITE_CLASS,
  NONE_CLASS,
  OVERFLOW_NONE_CLASS,
} from '../constants/animations';
import { removeClass, addClass, addClasses, on, off, removeClasses } from './popcorn-helper';
import { PAUSED, RUNNING } from '../constants/popcorn';

const animationValuesIn = animations[ANIMATION_TYPES.IN].map(item => item.value);
const animationValuesOut = animations[ANIMATION_TYPES.OUT].map(item => item.value);

const removeAnimation = (container, options, animationType) => {
  if (options.animation[animationType]) {
    removeClass(container, options.animation[animationType].type);
  }
};

const isRetarget = (trackEvent) => trackEvent.type === 'retargetForm';

const setDefaultOptions = (animationContainer, zindex) => {
  animationContainer.style.zIndex = zindex;
  animationContainer.style.display = 'flex';
  animationContainer.style.visibility = 'visible';
};

const containerInAnimationEnd = (props) => {
  const { animationName, container, options, formElements, formScrollable } = props;
  removeClasses(container, [animationName, options.animation.in.type, ANIMATED_CLASS]);

  formElements.forEach(element => {
    const elementAnimationEnd = (event) => {
      const { animationName: name, srcElement: src } = event;
      if (src.id === element.id && animationValuesIn.includes(name)) {
        element.removeEventListener('animationend', elementAnimationEnd);
        removeClasses(element, [name, options.animation.in.type]);
        removeClass(formScrollable, OVERFLOW_NONE_CLASS);
        formScrollable.style.overflowY = 'auto';
      }
    };

    on(element);
    addClasses(element, [options.animation.in.type, ANIMATED_CLASS]);
    element.addEventListener('animationend', elementAnimationEnd);
  });
};

export const animationStart = (options) => {
  const { _container: animationContainer } = options;
  if (!animationContainer) {
    return;
  }
  animationContainer.style.animationPlayState = RUNNING;
  removeAnimation(animationContainer, options, ANIMATION_TYPES.IDLE);
  removeAnimation(animationContainer, options, ANIMATION_TYPES.OUT);
  on(animationContainer);

  const startEvent = e => {
    animationContainer.removeEventListener('animationend', startEvent);
    const { animationName } = e;
    if (animationValuesIn.includes(animationName)) {
      animationContainer.classList.remove(options.animation.in.type);
      if (options.animation.idle) {
        addClass(animationContainer, options.animation.idle.type);
        animationContainer.classList.add(INFINITE_CLASS);
      }
    }
  };

  if (options.animation.in && options.animation.in.type !== NONE_CLASS) {
    removeClass(animationContainer, INFINITE_CLASS);

    addClass(animationContainer, ANIMATED_CLASS);
    addClass(animationContainer, options.animation.in.type);

    animationContainer.addEventListener('animationend', startEvent);
  } else if (options.animation.idle && options.animation.idle.type !== NONE_CLASS) {
    addClass(animationContainer, INFINITE_CLASS);
    addClass(animationContainer, ANIMATED_CLASS);
    addClass(animationContainer, options.animation.idle.type);
  }
};

export const formAnimationStart = (trackEvent, zindex = 1001) => {
  const {
    _container: animationContainer,
    _formElements: formElements,
    _formScrollable: formScrollable,
  } = trackEvent;
  if (!animationContainer) {
    return;
  }
  const props = isRetarget(trackEvent) ? trackEvent.options : trackEvent;

  removeAnimation(animationContainer, props, ANIMATION_TYPES.OUT);
  formElements.forEach(element => off(element));

  on(animationContainer.firstChild);
  on(animationContainer);

  if (props.animation.in && props.animation.in.type !== NONE_CLASS) {
    addClass(formScrollable, OVERFLOW_NONE_CLASS);
    addClasses(animationContainer, [ANIMATED_CLASS, props.animation.in.type]);

    const containerAnimationEnd = (e) => {
      const { animationName, srcElement } = e;
      if (srcElement.id === animationContainer.id && animationValuesIn.includes(animationName)) {
        animationContainer.removeEventListener('animationend', containerAnimationEnd);
        removeClasses(animationContainer, [animationName, props.animation.in.type, ANIMATED_CLASS]);
        containerInAnimationEnd({
          animationName,
          container: animationContainer,
          options: props,
          formElements,
          formScrollable,
        });
        setDefaultOptions(animationContainer, zindex);
      }
    };

    animationContainer.addEventListener('animationend', containerAnimationEnd);
  } else {
    formElements.forEach(element => on(element));
    setDefaultOptions(animationContainer, zindex);
  }
};

export const formUpdateIn = (trackEvent, options) => {
  const props = isRetarget(trackEvent) ? trackEvent.options : trackEvent;
  if (options.animation.in) {
    if (props.animation.in && props.animation.in.type === options.animation.in.type) {
      return;
    }

    const {
      _container: container,
      _formElements: formElements,
      _formScrollable: formScrollable,
    } = trackEvent;

    const containerAnimationEnd = (e) => {
      const { animationName, srcElement } = e;
      if (srcElement.id === container.id && animationValuesIn.includes(animationName)) {
        container.removeEventListener('animationend', containerAnimationEnd);
        containerInAnimationEnd({
          animationName,
          container,
          options,
          formElements,
          formScrollable,
        });
      }
    };
    formElements.forEach(element => {
      off(element);
      removeAnimation(element, props, ANIMATION_TYPES.IN);
    });
    removeAnimation(container, props, ANIMATION_TYPES.IN);
    addClasses(container, [ANIMATED_CLASS, options.animation.in.type]);
    addClass(formScrollable, OVERFLOW_NONE_CLASS);
    container.addEventListener('animationend', containerAnimationEnd);

    props.animation = props.animation
      ? { ...props.animation, in: options.animation.in }
      : { in: options.animation.in };
  }
};

export const animationEnd = (options) => {
  const { _container: animationContainer } = options;
  if (!animationContainer) {
    return;
  }

  const endEvent = e => {
    animationContainer.removeEventListener('animationend', endEvent);
    const { animationName } = e;
    if (animationValuesOut.includes(animationName)) {
      animationContainer.classList.remove(options.animation.out.type);
      if (options.animation.idle) {
        addClass(animationContainer, options.animation.idle.type);
        animationContainer.classList.add(INFINITE_CLASS);
      }
      off(animationContainer);
      if (options.animation.idle && options.animation.idle.duration) {
        animationContainer.style.animationPlayState = PAUSED;
      }
    }
  };

  if (options.animation.out && options.animation.out.type !== NONE_CLASS) {
    removeAnimation(animationContainer, options, ANIMATION_TYPES.IN);
    removeAnimation(animationContainer, options, ANIMATION_TYPES.IDLE);

    removeClass(animationContainer, INFINITE_CLASS);
    addClass(animationContainer, ANIMATED_CLASS);

    animationContainer.classList.add(options.animation.out.type);

    animationContainer.addEventListener('animationend', endEvent);
  } else {
    off(animationContainer);
    if (options.animation.idle && options.animation.idle.duration) {
      animationContainer.style.animationPlayState = PAUSED;
    }
  }
};

export const formAnimationEnd = (trackEvent) => {
  const {
    _container: container,
    _formElements: formElements,
    _formScrollable: formScrollable,
  } = trackEvent;

  if (!container) {
    return;
  }
  const props = isRetarget(trackEvent) ? trackEvent.options : trackEvent;
  if (props.animation.out && props.animation.out.type !== NONE_CLASS) {
    let waitingCount = formElements.length;

    removeAnimation(container, props, ANIMATION_TYPES.OUT);
    removeAnimation(container, props, ANIMATION_TYPES.IN);
    addClass(formScrollable, OVERFLOW_NONE_CLASS);

    const containerAnimationEnd = (e) => {
      const { animationName, srcElement } = e;
      if (srcElement.id === container.id && animationValuesOut.includes(animationName)) {
        container.removeEventListener('animationend', containerAnimationEnd);
        removeClasses(container, [animationName, props.animation.out.type,
          ANIMATED_CLASS]);
        removeClass(formScrollable, OVERFLOW_NONE_CLASS);
        formScrollable.style.overflowY = 'auto';
        container.style.zIndex = '-9999';
        container.style.visibility = 'hidden';
      }
    };
    formElements.forEach(element => {
      removeAnimation(element, props, ANIMATION_TYPES.OUT);
      removeAnimation(element, props, ANIMATION_TYPES.IN);

      addClasses(element, [props.animation.out.type, ANIMATED_CLASS]);

      const elementAnimationEnd = (e) => {
        const { animationName, srcElement } = e;
        if (srcElement.id === element.id && animationValuesOut.includes(animationName)) {
          waitingCount -= 1;
          element.removeEventListener('animationend', elementAnimationEnd);
          removeClasses(element, [animationName, props.animation.out.type]);
          off(element);
          if (!waitingCount) {
            addClasses(container, [props.animation.out.type, ANIMATED_CLASS]);
            container.addEventListener('animationend', containerAnimationEnd);
          }
        }
      };
      element.addEventListener('animationend', elementAnimationEnd);
    });
  } else {
    off(container);
    container.style.zIndex = '-9999';
    container.style.visibility = 'hidden';
  }
};

export const formUpdateOut = (trackEvent, options) => {
  const props = isRetarget(trackEvent) ? trackEvent.options : trackEvent;
  if (options.animation.out) {
    if (props.animation.out && props.animation.out.type === options.animation.out.type) {
      return;
    }

    const {
      _container: container,
      _formElements: formElements, _formScrollable: formScrollable,
    } = trackEvent;

    let waitingCount = formElements.length;

    removeAnimation(container, props, ANIMATION_TYPES.OUT);
    removeAnimation(container, props, ANIMATION_TYPES.IN);
    addClass(formScrollable, OVERFLOW_NONE_CLASS);

    const containerAnimationEnd = (e) => {
      const { animationName, srcElement } = e;
      if (srcElement.id === container.id && animationValuesOut.includes(animationName)) {
        container.removeEventListener('animationend', containerAnimationEnd);
        removeClasses(container, [animationName, options.animation.out.type,
          ANIMATED_CLASS]);
        removeClass(formScrollable, OVERFLOW_NONE_CLASS);
        formScrollable.style.overflowY = 'auto';
        formElements.forEach(element => on(element));
      }
    };
    formElements.forEach(element => {
      removeAnimation(element, props, ANIMATION_TYPES.OUT);
      removeAnimation(element, props, ANIMATION_TYPES.IN);

      addClasses(element, [options.animation.out.type, ANIMATED_CLASS]);
      const elementAnimationEnd = (e) => {
        const { animationName, srcElement } = e;
        if (srcElement.id === element.id && animationValuesOut.includes(animationName)) {
          waitingCount -= 1;
          element.removeEventListener('animationend', elementAnimationEnd);
          removeClasses(element, [animationName, options.animation.out.type]);
          off(element);
          if (!waitingCount) {
            addClasses(container, [ANIMATED_CLASS, options.animation.out.type]);
            container.addEventListener('animationend', containerAnimationEnd);
          }
        }
      };
      element.addEventListener('animationend', elementAnimationEnd);
    });

    props.animation = props.animation
      ? { ...props.animation, out: options.animation.out }
      : { out: options.animation.out };
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
