import { extendObservable } from 'mobx';
import { fade, generateUid, rgbFade } from '../../../lottie/utils';
import fonts from '../../../constants/fonts';
import {
  ANIMATION,
  BACKGROUND_COLOR,
  BACKGROUND_IMAGE,
  BRAND_LOGO_SRC,
  BTN_BACKGROUND,
  BTN_BORDER_RADIUS,
  BTN_BOTTOM_BORDER,
  BTN_FONT_COLOR,
  BTN_TEXT,
  CALL_NOTIFY_ADDRESS,
  CAPTION,
  CAPTION_ALIGNMENT,
  CAPTION_SIZE,
  DIAL_ENABLED,
  ELEMENTS,
  EMAIL_ADDRESS,
  EMAIL_ENABLED,
  END,
  FB_PIXEL_ID,
  FONT_COLOR,
  FONT_FAMILY,
  FONT_SIZE,
  HEIGHT,
  INNER_COLOR,
  INNER_HEIGHT,
  INNER_OPACITY,
  INNER_WIDTH,
  PHONE,
  PRIVACY_DISCLAIMER,
  PRIVACY_POLICY_CAPTION,
  PRIVACY_POLICY_LINK,
  SCRIPTS,
  SKIP_BUTTON,
  START,
  TARGET,
  TRANSITION,
  VERIFY_WEBHOOK,
  WEBHOOK,
  WEBHOOK_ENABLED,
  WIDTH,
  ZINDEX,
} from '../../../constants/popcorn';
// eslint-disable-next-line import/named
import { LEAD_GENERATOR_TEXT as defaultText } from '../../../constants/text-info';
import {
  ARRAY_ELEMENTS_RETARGET,
  ARRAY_TRANSITIONS,
  INPUT_VALUE,
} from '../../../constants/settings/retarget-settings';
import { formAnimationStart, formUpdateIn, formUpdateOut, formAnimationEnd } from '../../../utils/popcorn-animation';
import { FASTER } from '../../../constants/animations';
import {
  BLUR_ENTER_INPUT,
  NUMBER,
  TIME,
} from '../../../constants/forms';

function ListItemsForSelect(array) {
  const completedArray = [];
  array.sort().map(item => (completedArray.push({ label: item, value: item })));
  return completedArray;
}


/* eslint-disable no-underscore-dangle, no-multi-assign, no-prototype-builtins  */
((Popcorn) => {
  const DEFAULT_INPUT_FONT_COLOR = '#000000';
  const DEFAULT_FORM_FONT_COLOR = '#ffffff';
  const DEFAULT_BACKGROUND_COLOR = '#000000';
  const DEFAULT_INNER_FONT_COLOR = '#ffffff';
  const DEFAULT_BUTTON_BACKGROUND_COLOR = '#eb5054';
  const DEFAULT_BUTTON_FONT_COLOR = '#ffffff';
  const DEFAULT_BUTTON_BOTTOM_BORDER_COLOR = 'none';
  const DEFAULT_BUTTON_BORDER_RADIUS = '1';
  const DEFAULT_INPUT_BORDER_RADIUS = '5';


  Popcorn.plugin('form', () => {
    let popcorn;

    function isMobile() {
      return navigator.userAgent.match(/(iPad|iPhone|iPod|Android)/g);
    }

    function create(type) {
      return document.createElement(type);
    }

    function resumePlayback(options) {
      popcorn.interactive = true;
      if (options._transitionContainer) {
        options._transitionContainer.classList.remove('on');
        options._transitionContainer.classList.add('off');
      }

      if (options._container) {
        options._container.style.zIndex = '-9999';
        options._container.style.visibility = 'hidden';
      }
    }

    function buildForm(options) {
      const form = document.createElement('form');
      const personalizedTokens = window.digistrats
        ? window.digistrats.getPersonalizedTokens(true)
        : {};

      const inner = document.createElement('div');
      inner.classList.add('form-inner');

      const innerHeight = options.innerHeight
          || options._natives.manifest.options.innerHeight.default;
      const innerWidth = options.innerWidth
          || options._natives.manifest.options.innerWidth.default;
      if (!isMobile()) {
        inner.style.display = 'flex';
        inner.style.justifyContent = 'center';
        inner.style.height = `${innerHeight}%`;
        inner.style.width = `${innerWidth}%`;
        inner.style.alignItems = 'center';
        inner.style.margin = 'auto';
      } else {
        inner.style.margin = 'auto';
        inner.style.height = '90%';
        inner.style.width = inner.style.minWidth = '90%';
      }
      if (options.innerColor) {
        inner.style.background = options.innerColor.includes('#')
          ? fade(options.innerColor, options.innerOpacity / 100)
          : rgbFade(options.innerColor, options.innerOpacity / 100);
      }
      const formScrollable = document.createElement('div');
      formScrollable.classList.add('form-scrollable');
      formScrollable.style.width = '70%';
      options._formScrollable = formScrollable;

      const formScrollableInner = document.createElement('div');
      formScrollableInner.classList.add('form-scrollable-inner');
      options._formScrollableContainer = formScrollableInner;

      if (options.brandLogoSrc) {
        const brandLogoHandle = document.createElement('img');
        brandLogoHandle.classList.add('brand-logo');
        brandLogoHandle.id = `brand-logo-${options.id}`;
        brandLogoHandle.setAttribute('src', options.brandLogoSrc);
        formScrollableInner.appendChild(brandLogoHandle);
      }

      const fontSheet = document.createElement('link');
      fontSheet.rel = 'stylesheet';
      fontSheet.type = 'text/css';
      options._fontSheet = fontSheet;
      fontSheet.onload = () => {
        options._container.style.fontFamily = options.fontFamily;
        options._container.querySelectorAll('button').forEach((item) => {
          item.style.fontFamily = options.fontFamily;
        });
      };

      fontSheet.href = `https://fonts.googleapis.com/css?family=${
        options.fontFamily.replace(/\s/g, '+')}:400,700`;
      document.head.appendChild(fontSheet);

      const captionHandle = document.createElement('div');
      captionHandle.classList.add('lead-form-caption');
      captionHandle.id = `lead-form-caption-${options.id}`;
      captionHandle.innerText = typeof (options.caption) !== 'undefined'
        ? options.caption : options._natives.manifest.options.caption.default;
      captionHandle.style.fontSize = `${options.captionFontSize
        || options.fontSize}%`;
      captionHandle.style.textAlign = options.captionAlignment;
      formScrollableInner.appendChild(captionHandle);
      captionHandle.style.marginBottom = '0.5em';
      captionHandle.style.width = '100%';

      const inputWrapper = document.createElement('div');
      inputWrapper.classList.add('input-wrapper');

      options.elements.forEach((declaration) => {
        let input;
        switch (declaration.type) {
          case 'singleline':
            input = document.createElement('input');
            input.setAttribute('type', 'text');
            input.setAttribute('maxlength', '80');
            input.style.borderRadius = `${DEFAULT_INPUT_BORDER_RADIUS}px`;
            input.setAttribute('aria-label', declaration.label);
            input.setAttribute('aria-required', declaration.required ? 'true' : 'false');
            break;
          case 'multiline':
            input = document.createElement('textarea');
            input.setAttribute('maxlength', '250');
            input.style.marginBottom = '0.5em';
            input.style.marginTop = '0.5em';
            input.style.paddingBottom = '3em';
            input.style.borderRadius = `${DEFAULT_INPUT_BORDER_RADIUS}px`;
            input.setAttribute('aria-label', declaration.label);
            input.setAttribute('aria-required', declaration.required ? 'true' : 'false');
            break;
          case 'email':
            input = document.createElement('input');
            input.setAttribute('type', 'email');
            input.style.borderRadius = `${DEFAULT_INPUT_BORDER_RADIUS}px`;
            input.setAttribute('aria-label', declaration.label);
            input.setAttribute('aria-required', declaration.required ? 'true' : 'false');
            break;
          case 'number':
            input = document.createElement('input');
            input.setAttribute('type', 'text');
            input.setAttribute('maxlength', '80');
            input.setAttribute('pattern', '\\d*');
            input.setAttribute('inputmode', 'numeric');
            input.addEventListener('input', () => {
              const strippedNumber = input.value.replace(/[^0-9]/g, '');
              input.value = strippedNumber;
            });
            input.style.borderRadius = `${DEFAULT_INPUT_BORDER_RADIUS}px`;
            input.setAttribute('aria-label', declaration.label);
            input.setAttribute('aria-required', declaration.required ? 'true' : 'false');
            break;
          case 'date':
            input = document.createElement('input');
            input.setAttribute('type', 'date');
            input.style['-webkit-appearance'] = 'none';
            input.style['-moz-appearance'] = 'none';
            input.style.borderRadius = `${DEFAULT_INPUT_BORDER_RADIUS}px`;
            input.setAttribute('aria-label', declaration.label);
            input.setAttribute('aria-required', declaration.required ? 'true' : 'false');
            break;
          default:
            break;
        }

        if (input) {
          input.setAttribute('name', declaration.token);
          input.setAttribute('id', `form-input-${declaration.token}`);
          input.classList.add('popcorn-form-input');

          // Add validation and accessibility attributes
          if (declaration.validation) {
            if (declaration.validation.pattern) {
              input.setAttribute('pattern', declaration.validation.pattern);
            }
            if (declaration.validation.minLength) {
              input.setAttribute('minlength', declaration.validation.minLength);
            }
            if (declaration.validation.maxLength) {
              input.setAttribute('maxlength', declaration.validation.maxLength);
            }
          }

          // Real-time validation feedback
          const validationTimeout = {};
          input.addEventListener('input', () => {
            clearTimeout(validationTimeout[declaration.token]);
            validationTimeout[declaration.token] = setTimeout(() => {
              validateField(input, declaration);
            }, 300);
          });

          input.addEventListener('blur', () => {
            validateField(input, declaration);
          });

          if (personalizedTokens[declaration.token]) {
            input.setAttribute('value', personalizedTokens[declaration.token]);
          }
          input.setAttribute('placeholder', `${declaration.label}${declaration.required ? ' *' : ''}`);
          inputWrapper.appendChild(input);

          // Store reference for cleanup
          if (!options._formInputs) {
            options._formInputs = [];
          }
          options._formInputs.push(input);
        }
      });

      inputWrapper.style.display = 'flex';
      inputWrapper.style.justifyContent = 'space-between';
      inputWrapper.style.flexGrow = '4';
      inputWrapper.style.marginRight = '0.7em';
      inputWrapper.style.color = DEFAULT_INPUT_FONT_COLOR;

      const buttonsInner = document.createElement('div');
      buttonsInner.classList.add('buttons-inner');
      buttonsInner.style.width = 'auto';
      buttonsInner.style.flexGrow = '0.5';
      buttonsInner.style.display = 'grid';

      const submitButton = document.createElement('button');
      submitButton.innerText = typeof (options.btnText) !== 'undefined'
        ? options.btnText
        : 'Play';
      const wrapperContainer = document.createElement('div');
      wrapperContainer.classList.add('input-wrapper-container');
      wrapperContainer.appendChild(inputWrapper);
      buttonsInner.appendChild(submitButton);
      wrapperContainer.appendChild(buttonsInner);

      if (options.elements.length === 2) {
        wrapperContainer.style.flexDirection = 'column';
        inputWrapper.style.flexDirection = 'column';
        inputWrapper.style.width = '70%';
        inputWrapper.style.marginRight = '0';
        inputWrapper.firstChild.style.marginBottom = '1em';
        buttonsInner.style.width = '70%';
      } else if (options.elements.length === 3) {
        inputWrapper.style.flexGrow = '0';
        inputWrapper.style.marginRight = '0';
        inputWrapper.style.flexWrap = 'wrap';
        inputWrapper.style.alignItems = 'center';
        inputWrapper.style.display = 'flex';
        inputWrapper.style.width = '90%';
        wrapperContainer.style.flexDirection = 'column';
        for (let i = 0; i < inputWrapper.childNodes.length - 1; i++) {
          inputWrapper.childNodes[i].style.width = '49%';
        }
        inputWrapper.childNodes[2].style.width = '10%';
        inputWrapper.childNodes[2].style.flexGrow = '5';
        inputWrapper.childNodes[2].style.marginRight = '0.5em';
        inputWrapper.appendChild(buttonsInner);
      } else if (options.elements.length === 4) {
        wrapperContainer.style.flexDirection = 'column';
        inputWrapper.style.flexGrow = '0';
        inputWrapper.style.marginRight = '0';
        inputWrapper.style.flexWrap = 'wrap';
        inputWrapper.style.alignItems = 'center';
        inputWrapper.style.display = 'flex';
        inputWrapper.style.width = '100%';
        buttonsInner.style.maxWidth = '100%';
        submitButton.style.padding = '0 1em';
        for (let j = 0; j < inputWrapper.childNodes.length; j++) {
          inputWrapper.childNodes[j].style.width = '49%';
          inputWrapper.childNodes[j].style.marginBottom = '0.5em';
        }
      } else if (options.elements.length === 5) {
        inputWrapper.style.flexGrow = '0';
        inputWrapper.style.marginRight = '0';
        inputWrapper.style.flexDirection = 'column';
        for (let k = 0; k < inputWrapper.childNodes.length - 1; k++) {
          inputWrapper.childNodes[k].style.marginBottom = '0.5em';
        }
        inputWrapper.style.width = '80%';
        buttonsInner.style.width = '100%';
        buttonsInner.style.maxWidth = '100%';
        submitButton.style.boxSizing = 'border-box';
        wrapperContainer.style.justifyContent = 'center';
        inputWrapper.appendChild(buttonsInner);
      }
      submitButton.style.fontColor = options.buttonFontColor;
      wrapperContainer.id = `wrapper-container-${options.id}`;
      formScrollableInner.appendChild(wrapperContainer);

      const skipButton = document.createElement('div');
      skipButton.innerText = 'Skip';
      skipButton.classList.add('skip-button');
      skipButton.style.fontColor = options.fontColor;
      skipButton.addEventListener('click', () => {
        if (!document.querySelector('meta[name=project]')) {
          return;
        }
        return resumePlayback(options);
      });

      if (options.privacyDisclaimer) {
        const disclaimerHandle = document.createElement('div');
        disclaimerHandle.classList.add('privacy-disclaimer');
        disclaimerHandle.style.fontSize = '40%';
        disclaimerHandle.innerText = options.privacyDisclaimer;
        disclaimerHandle.id = `privacy-disclaimer-${options.id}`;
        formScrollableInner.appendChild(disclaimerHandle);
      }

      if (options.privacyPolicyCaption
          && options.privacyPolicyLink) {
        const privacyLinkHandle = document.createElement('a');
        privacyLinkHandle.classList.add('privacy-policy-link');
        privacyLinkHandle.innerText = options.privacyPolicyCaption;
        privacyLinkHandle.setAttribute('href', options.privacyPolicyLink);
        privacyLinkHandle.setAttribute('target', '_blank');
        privacyLinkHandle.id = `privacy-policy-link-${options.id}`;
        formScrollableInner.appendChild(privacyLinkHandle);
      }

      formScrollable.appendChild(formScrollableInner);
      inner.appendChild(formScrollable);
      form.appendChild(inner);
      if (options.enableSkipButton) {
        form.appendChild(skipButton);
      }
      form.classList.add('popcorn');
      form.classList.add('lead-form');
      form.setAttribute('action', '#');

      if (!isMobile()) {
        form.style.top = `${(100 - (options.height
            || options._natives.manifest.options.height.default)) / 2.0}%`;
        form.style.left = `${(100 - (options.width
            || options._natives.manifest.options.width.default)) / 2.0}%`;
        form.style.width = `${options.width
          || options._natives.manifest.options.width.default}%`;
        form.style.height = `${options.height
          || options._natives.manifest.options.height.default}%`;
      } else {
        form.style.width = form.style.height = '90%';
        form.style.top = form.style.left = '5%';
      }
      if (options.backgroundImage) {
        form.style.background = `url(${options.backgroundImage})`;
      } else if (options.backgroundColor) {
        form.style.background = `radial-gradient(circle, ${
          options.backgroundColor.includes('#')
            ? fade(options.backgroundColor, 0.07)
            : rgbFade(options.backgroundColor, 0.93, true)
        } 10%,${options.backgroundColor.includes('#')
          ? fade(options.backgroundColor, 0.8)
          : rgbFade(options.backgroundColor, 0.2, true)} 90%,${
          options.backgroundColor.includes('#')
            ? fade(options.backgroundColor, 1)
            : rgbFade(options.backgroundColor, 0, true)} 100%)`;
      }
      form.style.backgroundSize = 'cover';
      ['button', 'input', 'textarea'].forEach((type) => {
        form.querySelectorAll(type).forEach((item) => {
          item.style.fontSize = `${+options.fontSize + (isMobile() ? 50 : 0)}%`;
        });
      });
      form.style.color = options.fontColor;

      form.onsubmit = () => false;
      ['.buttons-inner > button'].forEach((selector) => {
        form.querySelectorAll(selector).forEach((item) => {
          item.style.width = '100%';
          item.style.boxSizing = 'border-box';
          item.style.borderColor = 'transparent';
          if (options.btnBottomBorder) {
            item.style.borderBottom = `1px solid ${
              fade(options.btnBottomBorder, 1)}`;
          }
          item.style.background = options.buttonBackground || DEFAULT_BUTTON_BACKGROUND_COLOR;
          item.style.borderRadius = `${options.buttonBorderRadius}px`;
          item.style.color = options.buttonFontColor;
        });
      });

      const elements = options._formScrollableContainer.childNodes;
      options._formElements = elements;
      elements.forEach(el => {
        if (options.animation.in) {
          el.classList.add(options.animation.in.type);
        }
      });

      return form;
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
          // eslint-disable-next-line no-new-func
          const fn = new Function('options', options.scripts[key]);
          options.scripts._compiled[key] = () => fn.apply(fn, [{
            event: options,
          }]);
        });
      }
    }

function validateField(input, declaration) {
  const value = input.value;
  let isValid = true;
  let errorMessage = '';

  // Clear previous validation states
  input.classList.remove('input-error', 'input-success');
  input.setAttribute('aria-invalid', 'false');

  // Remove existing error message
  const existingError = input.parentNode.querySelector('.field-error-message');
  if (existingError) {
    existingError.remove();
  }

  // Required field validation
  if (declaration.required && !value.trim()) {
    isValid = false;
    errorMessage = `${declaration.label} is required`;
  }

  // Type-specific validation
  if (isValid && value.trim()) {
    switch (declaration.type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          isValid = false;
          errorMessage = 'Please enter a valid email address';
        }
        break;
      case 'number':
        if (isNaN(value) || value.includes(' ')) {
          isValid = false;
          errorMessage = 'Please enter a valid number';
        }
        break;
      case 'date':
        if (!Date.parse(value)) {
          isValid = false;
          errorMessage = 'Please enter a valid date';
        }
        break;
    }

    // Custom validation rules
    if (declaration.validation) {
      if (declaration.validation.minLength && value.length < declaration.validation.minLength) {
        isValid = false;
        errorMessage = `Minimum length is ${declaration.validation.minLength} characters`;
      }
      if (declaration.validation.maxLength && value.length > declaration.validation.maxLength) {
        isValid = false;
        errorMessage = `Maximum length is ${declaration.validation.maxLength} characters`;
      }
      if (declaration.validation.pattern && !new RegExp(declaration.validation.pattern).test(value)) {
        isValid = false;
        errorMessage = declaration.validation.message || 'Invalid format';
      }
    }
  }

  // Update visual state and accessibility
  if (!isValid) {
    input.classList.add('input-error');
    input.setAttribute('aria-invalid', 'true');

    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error-message';
    errorDiv.setAttribute('role', 'alert');
    errorDiv.setAttribute('aria-live', 'polite');
    errorDiv.textContent = errorMessage;
    input.parentNode.insertBefore(errorDiv, input.nextSibling);
  } else if (value.trim()) {
    input.classList.add('input-success');
  }

  return isValid;
}

function onOrientationChange() {
  // eslint-disable-next-line no-unused-expressions
  document.activeElement.blur && document.activeElement.blur();
}

    return {
      _setup(options) {
        let target = options._target;
        let elementContainer = options._container;
        let outer;
        options.animation = options.animation
          || options._natives.manifest.options.animation.default;

        if (!options.start && options.animation && options.animation.in) {
          options.start = 0.01;
        }

        popcorn = this;

        function fillOption(optionName) {
          if (!options[optionName]) {
            options[optionName] = options._natives.manifest.options[optionName].default;
          }
        }

        if (options.elements) {
          options.elements = options.elements.map(el => {
            if (!el.hasOwnProperty('name') && !el.hasOwnProperty('id')) {
              el.name = INPUT_VALUE;
              el.id = generateUid();
            }
            return el;
          });
        }

        if (options.target) {
          target = typeof options.target === 'string'
            ? Popcorn.dom.find(options.target) : options.target;
        }

        if (!target) {
          return;
        }

        if (!options.elements) {
          options.elements = options._natives.manifest.options.elements.default.slice(0);
        }

        ['backgroundColor', 'buttonBorderRadius', 'captionFontSize', 'innerWidth', 'innerHeight',
          'innerOpacity', 'privacyDisclaimer', 'captionAlignment', 'fontColor', 'innerColor',
          'buttonBackground', 'btnBottomBorder', 'fontFamily', 'buttonFontColor'].forEach(fillOption);

        elementContainer = outer = create('div');
        outer.id = options.id;
        outer.style.position = 'absolute';
        outer.style.background = 'rgba(62, 62, 81, 0.67)';
        outer.classList.add('leadform-outer-container');
        // _outer.style.visibility = 'hidden';

        outer.style.width = outer.style.height = '100%';
        outer.style.top = outer.style.left = '0';
        outer.style.zIndex = +options.zindex;
        outer.style.display = 'flex';
        outer.style.justifyContent = 'center';
        outer.style.alignItems = 'center';

        options.fontSize = options.fontSize
            || options._natives.manifest.options.fontSize.default;

        options._transitionContainer = buildForm(options);
        outer.appendChild(options._transitionContainer);

        if (!isMobile()) {
          target.appendChild(elementContainer);
        } else {
          window.document.body.appendChild(elementContainer);
        }
        options._transitionContainer.classList.add('off');

        if (elementContainer) {
          elementContainer.classList.add('off');
        }

        options.toString = () => 'Lead Generator';

        buildScripts(options);

        options._transitionContainer.classList.add(FASTER);

        extendObservable(options, {
          _container: elementContainer,
          _transitionContainer: options._transitionContainer,
          _target: target,
          animation: options.animation,
        });
      },

      start(event, options) {
        if (options._submitted) {
          return;
        }
        const container = options._container;
        const transitionContainer = options._transitionContainer;
        formAnimationStart(options);
        if (container) {
          container.style.visibility = 'visible';

          // Safari Redraw hack - #3066
          container.style.display = 'none';
          container.style.display = '';
        }

        if (transitionContainer) {
          // Safari Redraw hack - #3066
          const safariHack = () => {
            transitionContainer.style.display = 'none';
            transitionContainer.style.display = '';
          };
          container.firstChild.classList.add('on');
          container.firstChild.classList.remove('off');

          if (['popcorn-fade', 'popcorn-slide-up', 'popcorn-slide-down']
            .indexOf(options.transition) === -1) {
            safariHack();
          } else {
            setTimeout(safariHack, 430);
          }
        }

        buildScripts(options);
        if (options.scripts && options.scripts._compiled
            && options.scripts._compiled.onStart) {
          options.scripts._compiled.onStart();
        }

        popcorn.interactive = false;
        setTimeout(() => {
          popcorn.pause();
        }, 10);
        window.addEventListener('orientationchange', onOrientationChange);
      },

      end(event, options) {
        window.removeEventListener('orientationchange', onOrientationChange);
        popcorn.interactive = true;

        formAnimationEnd(options);

        buildScripts(options);
        if (options.scripts && options.scripts._compiled
            && options.scripts._compiled.onEnd) {
          options.scripts._compiled.onEnd();
        }
      },

      _teardown(options) {
        // Clean up event listeners and DOM elements
        if (options._formInputs) {
          options._formInputs.forEach((input) => {
            // Remove all event listeners by cloning and replacing
            const clonedInput = input.cloneNode(true);
            if (input.parentNode) {
              input.parentNode.replaceChild(clonedInput, input);
            }
          });
          options._formInputs = [];
        }

        // Remove font sheet if it exists
        if (options._fontSheet && options._fontSheet.parentNode) {
          options._fontSheet.parentNode.removeChild(options._fontSheet);
        }

        // Remove container from target
        if (options._target && options._container) {
          options._target.removeChild(options._container);
        }

        // Clear references
        if (options._container) {
          options._container = null;
        }
        if (options._transitionContainer) {
          options._transitionContainer = null;
        }
        if (options._target) {
          options._target = null;
        }
        if (options._formScrollable) {
          options._formScrollable = null;
        }
        if (options._formScrollableContainer) {
          options._formScrollableContainer = null;
        }
        if (options._formElements) {
          options._formElements = [];
        }
      },

      destroy(options) {
        // Public destroy method for manual cleanup
        this._teardown(options);

        // Remove orientation change listener
        window.removeEventListener('orientationchange', onOrientationChange);

        // Clear any remaining references
        if (options.scripts && options.scripts._compiled) {
          options.scripts._compiled = {};
        }
      },

      _update(trackEvent, options) {
        let formUpdateNeeded = false;

        function updateElement(fieldName) {
          if (options.hasOwnProperty(fieldName)) {
            trackEvent[fieldName] = options[fieldName];
            formUpdateNeeded = true;
          }
        }

        if (options.transition && options.transition !== trackEvent.transition) {
          trackEvent._container.classList.remove(trackEvent.transition);
          trackEvent.transition = options.transition;
          trackEvent._container.classList.add(trackEvent.transition);
        }

        if (options.zindex) {
          trackEvent._container.style.zIndex = trackEvent.zindex = +options.zindex;
        }
        if (trackEvent._container) {
          const form = trackEvent._container.querySelector('form');
          const inner = form.querySelector('.form-inner');

          updateElement('elements', form);
          updateElement('brandLogoSrc', form);
          updateElement('backgroundImage', form);
          updateElement('backgroundColor', form);
          updateElement('caption', form);
          updateElement('btnText', form);
          updateElement('privacyDisclaimer', form);
          updateElement('privacyPolicyCaption', form);
          updateElement('privacyPolicyLink', form);
          updateElement('enableSkipButton', form);

          if (formUpdateNeeded) {
            trackEvent._container.removeChild(form);
            trackEvent._transitionContainer = buildForm(trackEvent);
            trackEvent._container.appendChild(trackEvent._transitionContainer);
          }

          if (options.hasOwnProperty('backgroundImage')) {
            trackEvent.backgroundImage = options.backgroundImage;
            form.style.background = `url(${options.backgroundImage}) no-repeat`;

            // TODO until we realize cropper
            form.style.backgroundSize = 'cover';
          }
          if (options.hasOwnProperty('backgroundColor')) {
            trackEvent.backgroundColor = options.backgroundColor;
            form.style.background = `radial-gradient(circle, ${
              rgbFade(trackEvent.backgroundColor, 0.93, true)} 10%,${
              rgbFade(trackEvent.backgroundColor, 0.2, true)} 90%,${
              rgbFade(trackEvent.backgroundColor, 0, true)} 100%)`;
          }
          if (options.hasOwnProperty('captionFontSize')) {
            trackEvent.captionFontSize = options.captionFontSize;
            form.querySelector('.lead-form-caption').style.fontSize = `${options.captionFontSize}%`;
          }
          if (options.hasOwnProperty('captionAlignment')) {
            trackEvent.captionAlignment = options.captionAlignment;
            form.querySelector('.lead-form-caption').style.textAlign = options.captionAlignment;
          }
          if (options.hasOwnProperty('innerWidth')) {
            trackEvent.innerWidth = options.innerWidth;
            inner.style.width = `${options.innerWidth}%`;
          }
          if (options.hasOwnProperty('innerHeight')) {
            trackEvent.innerHeight = options.innerHeight;
            inner.style.height = `${trackEvent.innerHeight}%`;
          }

          if (options.hasOwnProperty('innerColor')) {
            trackEvent.innerColor = options.innerColor;
            if (trackEvent.innerColor) {
              inner.style.background = rgbFade(trackEvent.innerColor,
                trackEvent.innerOpacity / 100);
            }
          }
          if (options.hasOwnProperty('innerOpacity')) {
            trackEvent.innerOpacity = options.innerOpacity;
            if (trackEvent.innerColor) {
              inner.style.background = rgbFade(trackEvent.innerColor,
                options.innerOpacity / 100);
            }
          }
          if (options.hasOwnProperty('height')) {
            trackEvent.height = options.height;
            form.style.top = `${(100 - options.height) / 2.0}%`;
            form.style.height = `${options.height}%`;
          }
          if (options.hasOwnProperty('width')) {
            trackEvent.width = options.width;
            form.style.left = `${(100 - options.width) / 2.0}%`;
            form.style.width = `${options.width}%`;
          }
          if (options.hasOwnProperty('buttonBackground')) {
            trackEvent.buttonBackground = options.buttonBackground;
            ['.buttons-inner > button'].forEach((selector) => {
              form.querySelectorAll(selector).forEach((item) => {
                item.style.background = (
                  trackEvent.buttonBackground.includes('#')
                    ? fade(trackEvent.buttonBackground, 1)
                    : trackEvent.buttonBackground
                );
              });
            });
          }
          if (options.hasOwnProperty('buttonFontColor')) {
            trackEvent.buttonFontColor = options.buttonFontColor;
            ['.buttons-inner > button'].forEach((selector) => {
              form.querySelectorAll(selector).forEach((item) => {
                item.style.color = (
                  trackEvent.buttonFontColor.includes('#')
                    ? fade(trackEvent.buttonFontColor, 1)
                    : trackEvent.buttonFontColor
                );
              });
            });
          }
          if (options.hasOwnProperty('buttonBorderRadius')) {
            trackEvent.buttonBorderRadius = options.buttonBorderRadius;
            ['.buttons-inner > button'].forEach((selector) => {
              form.querySelectorAll(selector).forEach((item) => {
                item.style.borderRadius = `${options.buttonBorderRadius}px`;
              });
            });
          }
          if (options.hasOwnProperty('btnBottomBorder')) {
            trackEvent.btnBottomBorder = options.btnBottomBorder;
            ['.buttons-inner > button'].forEach((selector) => {
              form.querySelectorAll(selector).forEach((item) => {
                item.style.borderBottom = `1px solid ${trackEvent.btnBottomBorder}`;
              });
            });
          }
          if (options.hasOwnProperty('fontColor')) {
            form.style.color = trackEvent.fontColor = options.fontColor;
            trackEvent._container.querySelectorAll('button').forEach((item) => {
              item.style.fontColor = options.fontColor;
            });
          }
          if (options.hasOwnProperty('fontSize')) {
            trackEvent.fontSize = options.fontSize;
            ['button', 'input', 'textarea'].forEach((type) => {
              form.querySelectorAll(type).forEach((item) => {
                item.style.fontSize = `${options.fontSize}%`;
              });
            });
          }
          if (options.hasOwnProperty('fontFamily')) {
            const fontSheet = document.createElement('link');
            fontSheet.rel = 'stylesheet';
            fontSheet.type = 'text/css';
            trackEvent.fontFamily = options.fontFamily
                || options._natives.manifest.options.fontFamily.default;
            // Store reference to generated sheet for removal later, remove any existing ones
            trackEvent._fontSheet = fontSheet;
            fontSheet.onload = () => {
              form.style.fontFamily = `"${options.fontFamily}"`;
              form.querySelectorAll('button').forEach((item) => {
                item.style.fontFamily = `"${options.fontFamily}"`;
              });
            };

            fontSheet.href = `https://fonts.googleapis.com/css?family=${
              options.fontFamily.replace(/\s/g, '+')}:400,700`;
            document.head.appendChild(fontSheet);
          }
          if (options.hasOwnProperty('webhook')) {
            trackEvent.webhook = options.webhook;
          }
          if (options.hasOwnProperty('emailAddress')) {
            trackEvent.emailAddress = options.emailAddress;
          }
          if (options.animation) {
            formUpdateIn(trackEvent, options);
            formUpdateOut(trackEvent, options);
          }
        }
      },
    };
  },
  {
    displayName: 'List Builder',
    options: {
      [START]: {
        elem: 'input',
        type: TIME,
        label: 'Start',
        units: 'seconds',
        default: 0,
      },
      [END]: {
        elem: 'input',
        type: TIME,
        label: 'End',
        units: 'seconds',
        default: 0,
      },
      [TARGET]: {
        hidden: true,
      },
      [ZINDEX]: {
        hidden: true,
      },
      [BRAND_LOGO_SRC]: {
        name: BRAND_LOGO_SRC,
        type: BLUR_ENTER_INPUT,
        label: 'Brand Logo URL',
        default: '',
      },
      [SKIP_BUTTON]: {
        name: SKIP_BUTTON,
        type: 'checkbox',
        label: 'Enable Skip Button',
        default: false,
      },
      [CAPTION]: {
        name: CAPTION,
        type: 'textarea',
        label: 'Caption',
        default: defaultText.caption,
      },
      [ELEMENTS]: {
        name: ELEMENTS,
        type: 'select',
        items: ARRAY_ELEMENTS_RETARGET,
        default: [{
          type: 'email',
          label: 'Email',
          value: 'email',
          token: 'EMAIL',
          id: generateUid(),
          name: INPUT_VALUE,
        }],
      },
      [PRIVACY_DISCLAIMER]: {
        name: PRIVACY_DISCLAIMER,
        type: 'textarea',
        label: 'Privacy Disclaimer',
        default: defaultText.disclaimer,
      },
      [PRIVACY_POLICY_CAPTION]: {
        name: PRIVACY_POLICY_CAPTION,
        type: 'text',
        label: 'Privacy Policy Label',
        default: '',
      },
      [PRIVACY_POLICY_LINK]: {
        name: PRIVACY_POLICY_LINK,
        type: 'text',
        label: 'Privacy Policy Link',
        default: '',
      },
      [WIDTH]: {
        name: WIDTH,
        max: 100,
        type: 'number',
        label: 'Width',
        default: 100,
      },
      [HEIGHT]: {
        name: HEIGHT,
        type: 'number',
        label: 'Height',
        default: 100,
      },
      [FONT_FAMILY]: {
        name: FONT_FAMILY,
        items: ListItemsForSelect(fonts),
        type: 'select',
        label: 'Font',
        googleFonts: true,
        default: 'Anton',
      },
      [CAPTION_SIZE]: {
        name: CAPTION_SIZE,
        type: 'slider',
        label: 'Caption Font Size',
        default: 76,
      },
      [CAPTION_ALIGNMENT]: {
        name: CAPTION_ALIGNMENT,
        type: 'radio',
        values: ['center', 'left', 'right'],
        default: 'center',
        label: 'Caption Alignment',
      },
      [FONT_SIZE]: {
        name: FONT_SIZE,
        type: 'slider',
        label: 'Font Size',
        default: 60,
      },
      [FONT_COLOR]: {
        name: FONT_COLOR,
        type: 'color',
        label: 'Font color',
        default: DEFAULT_FORM_FONT_COLOR,
      },
      [INNER_WIDTH]: {
        name: INNER_WIDTH,
        type: 'number',
        label: 'Inner Width',
        default: 90,
      },
      [INNER_HEIGHT]: {
        name: INNER_HEIGHT,
        type: 'number',
        label: 'Inner Height',
        default: 90,
      },
      [INNER_COLOR]: {
        name: INNER_COLOR,
        type: 'color',
        label: 'Inner Color',
        default: DEFAULT_INNER_FONT_COLOR,
      },
      [INNER_OPACITY]: {
        name: INNER_OPACITY,
        type: 'slider',
        label: 'Inner Opacity',
        default: 0,
      },
      [BACKGROUND_IMAGE]: {
        name: BACKGROUND_IMAGE,
        type: BLUR_ENTER_INPUT,
        label: 'Background Image URL',
        default: '',
      },
      [BACKGROUND_COLOR]: {
        name: BACKGROUND_COLOR,
        type: 'color',
        label: 'Background color',
        default: DEFAULT_BACKGROUND_COLOR,
      },
      [BTN_TEXT]: {
        name: BTN_TEXT,
        type: 'text',
        label: 'Submit Button Label',
        default: 'Play',
      },
      [BTN_BACKGROUND]: {
        name: BTN_BACKGROUND,
        type: 'color',
        label: 'Button Background color',
        default: DEFAULT_BUTTON_BACKGROUND_COLOR,
      },
      [BTN_FONT_COLOR]: {
        name: BTN_FONT_COLOR,
        type: 'color',
        label: 'Button Font color',
        default: DEFAULT_BUTTON_FONT_COLOR,
      },
      [BTN_BORDER_RADIUS]: {
        name: BTN_BORDER_RADIUS,
        type: 'number',
        label: 'Button border radius',
        default: DEFAULT_BUTTON_BORDER_RADIUS,
      },
      [BTN_BOTTOM_BORDER]: {
        name: BTN_BOTTOM_BORDER,
        type: 'color',
        label: 'Button Bottom Border color',
        default: DEFAULT_BUTTON_BOTTOM_BORDER_COLOR,
      },
      [WEBHOOK_ENABLED]: {
        name: WEBHOOK_ENABLED,
        type: 'checkbox',
        label: 'Webhook Call',
        default: false,
      },
      [WEBHOOK]: {
        name: WEBHOOK,
        type: 'input',
        label: 'Webhook Address',
        default: '',
      },
      [DIAL_ENABLED]: {
        name: DIAL_ENABLED,
        type: 'checkbox',
        label: 'Call Phone Number',
        default: false,
      },
      [PHONE]: {
        name: PHONE,
        type: 'input',
        label: 'Phone Number',
        caretField: 'urlCaretOffset',
        integrations: true,
        default: '',
      },
      [CALL_NOTIFY_ADDRESS]: {
        name: CALL_NOTIFY_ADDRESS,
        type: 'email',
        label: 'Email to notify about call attempt',
        default: '',
      },
      [VERIFY_WEBHOOK]: {
        name: VERIFY_WEBHOOK,
        type: 'button',
        label: 'Test Webhook',
      },
      [EMAIL_ENABLED]: {
        name: EMAIL_ENABLED,
        type: 'checkbox',
        label: 'Email Notification',
        default: false,
      },
      [EMAIL_ADDRESS]: {
        name: [EMAIL_ADDRESS],
        type: 'email',
        label: 'Notification Address',
        caretField: 'urlCaretOffset',
      },
      [FB_PIXEL_ID]: {
        name: [FB_PIXEL_ID],
        type: NUMBER,
        label: 'Facebook Pixel ID',
        default: null,
      },
      [TRANSITION]: {
        name: TRANSITION,
        type: 'select',
        items: ARRAY_TRANSITIONS,
        label: 'Transition',
        default: 'popcorn-none',
      },
      [SCRIPTS]: {
        onStart: '',
        onEnd: '',
      },
      [ANIMATION]: {
        default: {
          in: null,
          out: null,
        },
        hidden: true,
      },
    },
  });
})(window.Popcorn);
