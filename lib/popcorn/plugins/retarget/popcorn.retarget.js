import { extendObservable, runInAction } from 'mobx';
import _ from 'lodash';
import { fade, generateUid, rgbFade } from '../../../lottie/utils';
import fonts from '../../../constants/fonts';
import {
  ARRAY_ELEMENTS_RETARGET,
  ARRAY_TRANSITIONS,
  INPUT_VALUE,
} from '../../../constants/settings/retarget-settings';
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
  CAPTION_SIZE, DIAL_ENABLED,
  ELEMENTS,
  EMAIL_ADDRESS,
  EMAIL_ENABLED,
  END,
  FB_PIXEL_ID,
  FIELD_TEXT,
  FONT_COLOR,
  FONT_FAMILY,
  FONT_SIZE,
  HEIGHT,
  INNER_COLOR,
  INNER_HEIGHT,
  INNER_OPACITY,
  INNER_WIDTH, PHONE,
  PRIVACY_DISCLAIMER,
  PRIVACY_POLICY_CAPTION,
  PRIVACY_POLICY_LINK, SCRIPTS,
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

import { formAnimationStart, formUpdateIn, formUpdateOut, formAnimationEnd } from '../../../utils/popcorn-animation';
import { FASTER } from '../../../constants/animations';
import { BLUR_ENTER_INPUT, NUMBER } from '../../../constants/forms';

const extraWebhooks = ['webhook2', 'webhook3'];

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

  Popcorn.compose('retargetForm', () => {
    let popcorn;

    function isMobile() {
      return navigator.userAgent.match(/(iPad|iPhone|iPod|Android)/g);
    }

    function create(type) {
      return document.createElement(type);
    }

    function getRgba(color, alpha) {
      if (!color) {
        return;
      }
      return `rgba(${
        parseInt(color.substring(1, 3), 16)},${
        parseInt(color.substring(3, 5), 16)},${
        parseInt(color.substring(5, 7), 16)
      }, ${alpha ? alpha / 100.0 : 0})`;
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

    function buildForm(element) {
      const form = document.createElement('form');
      const personalizedTokens = window.digistrats
        ? window.digistrats.getPersonalizedTokens(true)
        : {};

      const inner = document.createElement('div');
      inner.classList.add('form-inner');

      const innerHeight = element.options.innerHeight
        || element.manifest.options.innerHeight.default;
      const innerWidth = element.options.innerWidth
        || element.manifest.options.innerWidth.default;
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
      if (element.options.innerColor) {
        inner.style.background = element.options.innerColor.includes('#')
          ? fade(element.options.innerColor, element.options.innerOpacity / 100)
          : rgbFade(element.options.innerColor, element.options.innerOpacity / 100);
      }
      const formScrollable = document.createElement('div');
      formScrollable.classList.add('form-scrollable');
      element._formScrollable = formScrollable;

      const formScrollableInner = document.createElement('div');
      formScrollableInner.classList.add('form-scrollable-inner');
      element._formScrollableContainer = formScrollableInner;

      if (element.options.brandLogoSrc) {
        const brandLogoHandle = document.createElement('img');
        brandLogoHandle.id = `builder-brand-logo-${element.id}`;
        brandLogoHandle.classList.add('brand-logo');
        brandLogoHandle.setAttribute('src', element.options.brandLogoSrc);
        formScrollableInner.appendChild(brandLogoHandle);
      }

      const fontSheet = document.createElement('link');
      fontSheet.rel = 'stylesheet';
      fontSheet.type = 'text/css';
      element._fontSheet = fontSheet;
      fontSheet.onload = () => {
        element._container.style.fontFamily = `"${element.options.fontFamily}"`;
        element._container.querySelectorAll('button').forEach((item) => {
          item.style.fontFamily = `"${element.options.fontFamily}"`;
        });
      };

      fontSheet.href = `https://fonts.googleapis.com/css?family=${
        element.options.fontFamily.replace(/\s/g, '+')}:400,700`;
      document.head.appendChild(fontSheet);

      const captionHandle = document.createElement('div');
      captionHandle.id = `builder-caption-${element.id}`;
      captionHandle.classList.add('retarget-caption');
      captionHandle.innerText = typeof (element.options.caption) !== 'undefined'
        ? element.options.caption : element.manifest.options.caption.default;
      captionHandle.style.fontSize = `${element.options.captionFontSize
          || element.options.fontSize}%`;
      captionHandle.style.textAlign = element.options.captionAlignment;
      formScrollableInner.appendChild(captionHandle);
      captionHandle.style.marginBottom = '0.5em';
      captionHandle.style.width = '100%';

      const inputWrapper = document.createElement('div');
      inputWrapper.classList.add('input-wrapper');

      element.options.elements.forEach((declaration) => {
        let input;
        switch (declaration.type) {
          case 'singleline':
            input = document.createElement('input');
            input.setAttribute('type', 'text');
            input.setAttribute('maxlength', '80');
            input.style.borderRadius = `${DEFAULT_INPUT_BORDER_RADIUS}px`;
            break;
          case 'multiline':
            input = document.createElement('textarea');
            input.setAttribute('maxlength', '250');
            input.style.marginBottom = '0.5em';
            input.style.marginTop = '0.5em';
            input.style.paddingBottom = '3em';
            input.style.borderRadius = `${DEFAULT_INPUT_BORDER_RADIUS}px`;
            break;
          case 'email':
            input = document.createElement('input');
            input.setAttribute('type', 'email');
            input.style.borderRadius = `${DEFAULT_INPUT_BORDER_RADIUS}px`;
            break;
          case 'number':
            input = document.createElement('input');
            input.setAttribute('type', 'text');
            input.setAttribute('maxlength', '80');
            input.setAttribute('pattern', '\\d*');
            input.addEventListener('input', () => {
              const strippedNumber = input.value.replace(/[^0-9]/g, '');
              input.value = strippedNumber;
            });
            input.style.borderRadius = `${DEFAULT_INPUT_BORDER_RADIUS}px`;
            break;
          case 'date':
            input = document.createElement('input');
            input.style['-webkit-appearance'] = 'none';
            input.style['-moz-appearance'] = 'none';
            input.style.borderRadius = `${DEFAULT_INPUT_BORDER_RADIUS}px`;
            break;
          default:
            break;
        }
        input.setAttribute('name', declaration.token);
        // input.style.width = '78%';
        if (personalizedTokens[declaration.token]) {
          input.setAttribute('value', personalizedTokens[declaration.token]);
        }
        input.setAttribute('placeholder', `${declaration.label} `);
        inputWrapper.appendChild(input);
      });

      inputWrapper.style.display = 'flex';
      inputWrapper.style.justifyContent = 'space-between';
      inputWrapper.style.flexGrow = '4';
      inputWrapper.style.marginRight = '0.5em';
      inputWrapper.style.color = DEFAULT_INPUT_FONT_COLOR;
      inputWrapper.style.borderRadius = `${DEFAULT_INPUT_BORDER_RADIUS}px`;

      const buttonsInner = document.createElement('div');
      buttonsInner.classList.add('buttons-inner');
      buttonsInner.style.width = 'auto';
      buttonsInner.style.flexGrow = '0.5';
      buttonsInner.style.display = 'grid';

      const submitButton = document.createElement('button');
      submitButton.innerText = typeof (element.options.btnText) !== 'undefined'
        ? element.options.btnText
        : 'Play';
      const wrapperContainer = document.createElement('div');
      wrapperContainer.id = `builder-wrapper-container-${element.id}`;
      wrapperContainer.classList.add('input-wrapper-container');
      wrapperContainer.appendChild(inputWrapper);
      buttonsInner.appendChild(submitButton);
      wrapperContainer.appendChild(buttonsInner);

      if (element.options.elements.length === 2) {
        wrapperContainer.style.flexDirection = 'column';
        inputWrapper.style.flexDirection = 'column';
        inputWrapper.style.width = '70%';
        inputWrapper.style.marginRight = '0';
        inputWrapper.firstChild.style.marginBottom = '1em';
        buttonsInner.style.width = '70%';
      } else if (element.options.elements.length === 3) {
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
      } else if (element.options.elements.length === 4) {
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
      } else if (element.options.elements.length === 5) {
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
      submitButton.style.fontColor = element.options.buttonFontColor;
      formScrollableInner.appendChild(wrapperContainer);

      const skipButton = document.createElement('div');
      skipButton.innerText = 'Skip';
      skipButton.classList.add('skip-button');
      skipButton.style.fontColor = element.options.fontColor;
      skipButton.addEventListener('click', () => {
        if (!document.querySelector('meta[name=project]')) {
          return;
        }
        return resumePlayback(element);
      });

      if (element.options.privacyDisclaimer && !element.isPersonalizer) {
        const disclaimerHandle = document.createElement('div');
        disclaimerHandle.id = `privacy-disclaimer-${element.id}`;
        disclaimerHandle.classList.add('privacy-disclaimer');
        disclaimerHandle.style.fontSize = '40%';
        disclaimerHandle.innerText = element.options.privacyDisclaimer;
        formScrollableInner.appendChild(disclaimerHandle);
      }

      if (element.options.privacyPolicyCaption
          && element.options.privacyPolicyLink) {
        const privacyLinkHandle = document.createElement('a');
        privacyLinkHandle.classList.add('privacy-policy-link');
        privacyLinkHandle.id = `privacy-policy-link-${element.id}`;
        privacyLinkHandle.innerText = element.options.privacyPolicyCaption;
        privacyLinkHandle.setAttribute('href', element.options.privacyPolicyLink);
        privacyLinkHandle.setAttribute('target', '_blank');
        formScrollableInner.appendChild(privacyLinkHandle);
      }

      formScrollable.appendChild(formScrollableInner);
      inner.appendChild(formScrollable);
      form.appendChild(inner);
      if (element.options.enableSkipButton) {
        form.appendChild(skipButton);
      }
      form.classList.add('popcorn');
      form.classList.add('retarget-form');
      form.setAttribute('action', '#');

      if (!isMobile()) {
        form.style.top = `${(100 - (element.options.height
            || element.manifest.options.height.default)) / 2.0}%`;
        form.style.left = `${(100 - (element.options.width
            || element.manifest.options.width.default)) / 2.0}%`;
        form.style.width = `${element.options.width
            || element.manifest.options.width.default}%`;
        form.style.height = `${element.options.height
            || element.manifest.options.height.default}%`;
      } else {
        form.style.width = form.style.height = '90%';
        form.style.top = form.style.left = '5%';
      }
      if (element.options.backgroundImage) {
        form.style.background = `url(${element.options.backgroundImage})`;
      } else if (element.options.backgroundColor) {
        form.style.background = `radial-gradient(circle, ${
          element.options.backgroundColor.includes('#')
            ? getRgba(element.options.backgroundColor, 7)
            : rgbFade(element.options.backgroundColor, 0.93, true)
        } 10%,${element.options.backgroundColor.includes('#')
          ? getRgba(element.options.backgroundColor, 80)
          : rgbFade(element.options.backgroundColor, 0.2, true)} 90%,${
          element.options.backgroundColor.includes('#')
            ? getRgba(element.options.backgroundColor, 100)
            : rgbFade(element.options.backgroundColor, 0, true)
        } 100%)`;
      }
      form.style.backgroundSize = 'cover';
      ['button', 'input', 'textarea'].forEach((type) => {
        form.querySelectorAll(type).forEach((item) => {
          item.style.fontSize = `${+element.options.fontSize + (isMobile() ? 50 : 0)}%`;
        });
      });
      form.style.color = element.options.fontColor;

      form.onsubmit = () => false;
      ['.buttons-inner > button'].forEach((selector) => {
        form.querySelectorAll(selector).forEach((item) => {
          item.style.width = '100%';
          item.style.boxSizing = 'border-box';
          item.style.borderColor = 'transparent';
          if (element.options.btnBottomBorder) {
            item.style.borderBottom = `1px solid ${element.options.btnBottomBorder}`;
          }
          item.style.background = element.options.buttonBackground
            || DEFAULT_BUTTON_BACKGROUND_COLOR;
          item.style.borderRadius = `${element.options.buttonBorderRadius}px`;
          item.style.color = element.options.buttonFontColor;
        });
      });

      const elements = element._formScrollableContainer.childNodes;
      element._formElements = elements;
      elements.forEach(el => {
        if (element.options.animation.in) {
          el.classList.add(element.options.animation.in.type);
        }
      });

      return form;
    }

    function buildScripts(options, manifest) {
      if (!options.scripts) {
        options.scripts = {};

        Object.keys(manifest.options.scripts).forEach((key) => {
          options.scripts[key] = '';
        });
      } else {
        options.scripts._compiled = options.scripts._compiled || {};

        Object.keys(manifest.options.scripts).forEach((key) => {
          /* jslint evil: true */
          // eslint-disable-next-line no-new-func
          const fn = new Function('options', options.scripts[key]);
          options.scripts._compiled[key] = () => fn.apply(fn, [{
            event: options,
          }]);
        });
      }
    }

    function onOrientationChange() {
      // eslint-disable-next-line no-unused-expressions
      document.activeElement.blur && document.activeElement.blur();
    }

    return {
      _setup(element) {
        let target = element._target;
        let elementContainer = element._container;
        let outer;

        element.options.animation = element.options.animation
          || element.manifest.options.animation.default;

        popcorn = this;

        if (element.options.elements) {
          element.options.elements = element.options.elements.map(el => {
            if (!el.hasOwnProperty('name') && !el.hasOwnProperty('id')) {
              el.name = INPUT_VALUE;
              el.id = generateUid();
            }
            return el;
          });
        }

        function fillOption(optionName) {
          if (!element.options[optionName]) {
            element.options[optionName] = element.manifest.options[optionName].default;
          }
        }

        function fillObjectOption(optionName) {
          if (!element.options[optionName]) {
            element.options[optionName] = { ...element.manifest.options[optionName].default };
          }
        }

        if (element.options.target) {
          target = typeof element.options.target === 'string'
            ? Popcorn.dom.find(element.options.target) : element.options.target;
        }

        if (!target) {
          return;
        }

        if (!element.options.elements) {
          element.options.elements = element.manifest.options.elements.default.slice(0);
        }

        ['backgroundColor', 'buttonBorderRadius', 'captionFontSize', 'innerWidth', 'innerHeight',
          'innerOpacity', 'privacyDisclaimer', 'captionAlignment', 'fontColor', 'innerColor',
          'buttonBackground', 'btnBottomBorder', 'fontFamily', 'buttonFontColor', 'webhook',
        ].forEach(fillOption);

        extraWebhooks.forEach(fillObjectOption);
        extraWebhooks.forEach((webhookName) => {
          if (!element.options[webhookName].value && !element.options[webhookName].hidden) {
            element.options[webhookName].hidden = true;
          }
        });

        elementContainer = outer = create('div');
        outer.id = element.id;
        outer.style.position = 'absolute';
        outer.style.background = 'rgba(62, 62, 81, 0.67)';
        outer.classList.add('retarget-outer-container');
        // _outer.style.visibility = 'hidden';

        outer.style.width = outer.style.height = '100%';
        outer.style.top = outer.style.left = '0';
        outer.style.zIndex = +element.options.zindex;
        outer.style.display = 'flex';
        outer.style.justifyContent = 'center';
        outer.style.alignItems = 'center';

        // overlay arrow hint
        const overlay = document.createElement('div');
        overlay.classList.add('overlay-arrow', 'on');

        // create arrow hint svg
        const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M68.7705 61.9585C53.6729 59.1867 41.6596 54.1241 38.166 48.8973C35.213 44.4916 34.8473 38.2327 37.1133 31.2063C31.303 29.1839 25.7175 26.491 21.0438 23.5385C17.1984 21.1142 14.4246 18.6122 12.4284 16.4156L13.8427 21.5047C14.0613 22.3073 13.5957 23.1267 12.8029 23.3472C12.0002 23.5658 11.1808 23.1002 10.9505 22.3056L7.44816 9.70597C7.40279 9.56547 7.37889 9.41874 7.37647 9.26579C7.37666 9.15398 7.39472 9.05563 7.41278 8.95727C7.47137 8.69352 7.5952 8.46207 7.76279 8.26916C7.8515 8.17361 7.94824 8.0897 8.06466 8.00941C8.34225 7.82653 8.69391 7.73858 9.0516 7.78392C9.0516 7.78392 9.0516 7.78392 9.06144 7.78573C9.06144 7.78573 9.08111 7.78934 9.09094 7.79114L23.0426 9.66127C23.8662 9.77181 24.4391 10.5277 24.3286 11.3513C24.218 12.1748 23.4621 12.7478 22.6386 12.6372L12.0617 11.2139C13.8588 13.7196 16.9972 17.4476 22.6376 21.0046C27.0754 23.802 32.5045 26.4052 38.1531 28.3674C41.5023 20.2589 47.5757 13.3725 53.1296 11.586C59.2355 9.22987 67.6878 9.76499 73.5883 12.9021C76.7571 14.5819 78.7336 16.7749 79.3 19.2275C80.5127 24.4727 75.5281 29.6375 65.2843 33.7655C65.2413 33.778 65.1984 33.7904 65.1536 33.8127C58.1439 35.9419 48.9206 34.8992 39.9605 32.1459C38.7213 36.0158 37.466 42.4651 40.6581 47.2299C47.432 57.3495 96.567 67.9973 119.951 54.9861C120.676 54.5803 121.593 54.8503 121.99 55.5638C122.396 56.289 122.138 57.1973 121.412 57.603C110.451 63.7038 92.9863 65.5708 73.4882 62.7332C71.884 62.4997 70.3147 62.2421 68.7705 61.9585ZM41.01 29.3088C49.3587 31.8482 57.8952 32.8664 64.2221 30.9677C72.6454 27.5628 77.1756 23.433 76.3687 19.9093C76.0145 18.3497 74.519 16.8043 72.175 15.5606C67.9223 13.3055 60.4579 11.9859 54.1238 14.4222C49.4013 15.9444 44.0348 22.1371 41.01 29.3088Z');
        path.setAttribute('fill', '#EB5054');
        svgElement.setAttribute('width', 129);
        svgElement.setAttribute('height', 72);
        svgElement.setAttribute('viewBox', '0 0 129 72');
        svgElement.setAttribute('fill', 'none');
        svgElement.appendChild(path);
        svgElement.classList.add('arrow-image');

        const containerHint = document.createElement('div');
        containerHint.classList.add('container-hint');

        const titleHint = document.createElement('h3');
        const fillOutField = document.createElement('p');
        const tryNowField = document.createElement('p');
        const experienceField = document.createElement('p');

        fillOutField.classList.add('container-fill-out');

        titleHint.innerText = 'Create your very own personalized video';
        const spanElementField = element.options.elements.map(el => `<span class="element-field">${el.label}</span>`);
        fillOutField.innerHTML = `<span class="fill-out">Fill out your</span>${spanElementField}`;
        tryNowField.innerHTML = `Click <span class="btn-form-name">${element.options.btnText ?? element.manifest.options.btnText.default}</span>`;
        experienceField.innerHTML = 'Experience the <span>magic of the personalization</span>';

        containerHint.appendChild(titleHint);
        containerHint.appendChild(fillOutField);
        containerHint.appendChild(tryNowField);
        containerHint.appendChild(experienceField);
        overlay.appendChild(svgElement);
        overlay.appendChild(containerHint);

        element.options.fontSize = element.options.fontSize
            || element.manifest.options.fontSize.default;

        element._transitionContainer = buildForm(element);
        outer.appendChild(element._transitionContainer);
        outer.appendChild(overlay);

        if (!isMobile()) {
          target.appendChild(elementContainer);
        } else {
          window.document.body.appendChild(elementContainer);
        }

        element._transitionContainer.classList.add('off');

        element._transitionContainer.classList.add(FASTER);

        element.options.toString = () => 'List Builder';

        buildScripts(element.options, element.manifest);

        extendObservable(element, {
          _container: elementContainer,
          _transitionContainer: element._transitionContainer,
        });

        extendObservable(element.options, {
          animation: element.options.animation,
          webhook2: element.options.webhook2,
          webhook3: element.options.webhook3,
        });
      },

      start(element) {
        const overlayArrowHint = document.querySelector('.overlay-arrow');
        const containerFillOut = document.querySelector('.container-fill-out');
        const btnFormName = document.querySelector('.btn-form-name');

        if (element.options._submitted) {
          return;
        }

        if (overlayArrowHint && overlayArrowHint.classList.contains('off') && containerFillOut && btnFormName) {
          const spanElementField = element.options.elements.map(el => `<span class="element-field">${el.label}</span>`);
          containerFillOut.innerHTML = `<span class="fill-out">Fill out your</span>${spanElementField}`;
          btnFormName.innerText = element.options.btnText
            ?? element.manifest.options.btnText.default;
        }
        const container = element._container;

        const transitionContainer = element._transitionContainer;

        formAnimationStart(element, 1002);
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
            .indexOf(element.options.transition) === -1) {
            safariHack();
          } else {
            setTimeout(safariHack, 430);
          }
        }

        buildScripts(element.options, element.manifest);
        if (element.options.scripts && element.options.scripts._compiled
            && element.options.scripts._compiled.onStart) {
          element.options.scripts._compiled.onStart();
        }

        const hideOverlayHint = (e) => {
          e.stopPropagation();
          overlayArrowHint.removeEventListener('click', hideOverlayHint);
          overlayArrowHint.classList.remove('on');
          overlayArrowHint.classList.add('off');
        };

        if (overlayArrowHint) {
          setTimeout(() => {
            overlayArrowHint.classList.remove('on');
            overlayArrowHint.classList.add('off');
            overlayArrowHint.removeEventListener('click', hideOverlayHint);
          }, 5000);
          overlayArrowHint.addEventListener('click', hideOverlayHint);
        }

        popcorn.interactive = false;
        window.addEventListener('orientationchange', onOrientationChange);
      },

      end(element) {
        window.removeEventListener('orientationchange', onOrientationChange);
        popcorn.interactive = true;

        formAnimationEnd(element);

        buildScripts(element.options, element.manifest);
        if (element.options.scripts && element.options.scripts._compiled
            && element.options.scripts._compiled.onEnd) {
          element.options.scripts._compiled.onEnd();
        }
      },

      _update(element, options) {
        let formUpdateNeeded = false;

        function updateElement(fieldName) {
          if (options.hasOwnProperty(fieldName)) {
            element.options[fieldName] = options[fieldName];
            formUpdateNeeded = true;
          }
        }

        if (options.transition && options.transition !== element.options.transition) {
          element._container.classList.remove(element.options.transition);
          element.options.transition = options.transition;
          element._container.classList.add(element.transition);
        }

        if (options.zindex) {
          element._container.style.zIndex = element.zindex = +options.zindex;
        }
        if (element._container) {
          const form = element._container.querySelector('form');
          const inner = form.querySelector('.form-inner');

          updateElement('elements', form);
          updateElement('brandLogoSrc', form);
          updateElement('backgroundImage', form);
          updateElement('caption', form);
          updateElement('btnText', form);
          updateElement('privacyDisclaimer', form);
          updateElement('privacyPolicyCaption', form);
          updateElement('privacyPolicyLink', form);
          updateElement('enableSkipButton', form);

          if (formUpdateNeeded) {
            element._container.removeChild(form);
            element._transitionContainer = buildForm(element);
            element._container.appendChild(element._transitionContainer);
          }

          if (options.hasOwnProperty('backgroundImage')) {
            element.options.backgroundImage = options.backgroundImage;
            form.style.background = `url(${options.backgroundImage}) no-repeat`;

            // TODO until we realize cropper
            form.style.backgroundSize = 'cover';
          }
          if (options.hasOwnProperty('backgroundColor')) {
            element.options.backgroundColor = options.backgroundColor;
            form.style.background = `radial-gradient(circle, ${
              rgbFade(element.options.backgroundColor, 0.93, true)} 10%,${
              rgbFade(element.options.backgroundColor, 0.2, true)} 90%,${
              rgbFade(element.options.backgroundColor, 0, true)} 100%)`;
          }
          if (options.hasOwnProperty('captionFontSize')) {
            element.options.captionFontSize = options.captionFontSize;
            form.querySelector('.retarget-caption').style.fontSize = `${options.captionFontSize}%`;
          }
          if (options.hasOwnProperty('captionAlignment')) {
            element.options.captionAlignment = options.captionAlignment;
            form.querySelector('.retarget-caption').style.textAlign = options.captionAlignment;
          }
          if (options.hasOwnProperty('innerWidth')) {
            element.options.innerWidth = options.innerWidth;
            inner.style.width = `${options.innerWidth}%`;
          }
          if (options.hasOwnProperty('innerHeight')) {
            element.options.innerHeight = options.innerHeight;
            inner.style.height = `${element.options.innerHeight}%`;
          }

          if (options.hasOwnProperty('innerColor')) {
            element.options.innerColor = options.innerColor;
            if (element.options.innerColor) {
              inner.style.background = rgbFade(element.options.innerColor,
                element.options.innerOpacity / 100.0);
            }
          }
          if (options.hasOwnProperty('innerOpacity')) {
            element.options.innerOpacity = options.innerOpacity;
            if (element.options.innerColor) {
              inner.style.background = element.options.innerColor.includes('#')
                ? getRgba(element.options.innerColor, options.innerOpacity)
                : rgbFade(element.options.innerColor, element.options.innerOpacity / 100.0);
            }
          }
          if (options.hasOwnProperty('height')) {
            element.options.height = options.height;
            form.style.top = `${(100 - options.height) / 2.0}%`;
            form.style.height = `${options.height}%`;
          }
          if (options.hasOwnProperty('width')) {
            element.options.width = options.width;
            form.style.left = `${(100 - options.width) / 2.0}%`;
            form.style.width = `${options.width}%`;
          }
          if (options.hasOwnProperty('buttonBackground')) {
            element.options.buttonBackground = options.buttonBackground;
            ['.buttons-inner > button'].forEach((selector) => {
              form.querySelectorAll(selector).forEach((item) => {
                item.style.background = element.options.buttonBackground;
              });
            });
          }
          if (options.hasOwnProperty('buttonFontColor')) {
            element.options.buttonFontColor = options.buttonFontColor;
            ['.buttons-inner > button'].forEach((selector) => {
              form.querySelectorAll(selector).forEach((item) => {
                item.style.color = element.options.buttonFontColor;
              });
            });
          }
          if (options.hasOwnProperty('buttonBorderRadius')) {
            element.options.buttonBorderRadius = options.buttonBorderRadius;
            ['.buttons-inner > button'].forEach((selector) => {
              form.querySelectorAll(selector).forEach((item) => {
                item.style.borderRadius = `${options.buttonBorderRadius}px`;
              });
            });
          }
          if (options.hasOwnProperty('btnBottomBorder')) {
            element.options.btnBottomBorder = options.btnBottomBorder;
            ['.buttons-inner > button'].forEach((selector) => {
              form.querySelectorAll(selector).forEach((item) => {
                item.style.borderBottom = `1px solid ${element.options.btnBottomBorder}`;
              });
            });
          }
          if (options.hasOwnProperty('fontColor')) {
            form.style.color = element.options.fontColor = options.fontColor;
            element._container.querySelectorAll('button').forEach((item) => {
              item.style.fontColor = options.fontColor;
            });
          }
          if (options.hasOwnProperty('fontSize')) {
            element.options.fontSize = options.fontSize;
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
            element.options.fontFamily = options.fontFamily
                || element.manifest.options.fontFamily.default;
            // Store reference to generated sheet for removal later, remove any existing ones
            element._fontSheet = fontSheet;
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
            element.options.webhook = options.webhook;
          }
          extraWebhooks.forEach(webhookName => {
            if (options.hasOwnProperty(webhookName)) {
              const webhookValue = (_.isObject(options[webhookName]) ? options[webhookName].value
                : options[webhookName]) || '';
              if (element.options[webhookName]) {
                element.options[webhookName].value = webhookValue;
              } else {
                element.options[webhookName] = { value: webhookValue, hidden: false };
              }
            }
          });
          if (options.hasOwnProperty('addWebhook')) {
            runInAction(() => {
              if (element.options.webhook2 && element.options.webhook2.hidden) {
                element.options.webhook2.hidden = false;
              } else if (element.options.webhook3 && element.options.webhook3.hidden) {
                element.options.webhook3.hidden = false;
              }
            });
          }
          if (options.hasOwnProperty('removeWebhook')) {
            runInAction(() => {
              if (options.removeWebhook === 2) {
                if (element.options.webhook3 && !element.options.webhook3.hidden) {
                  element.options.webhook2 = { ...element.options.webhook3 };
                  element.options.webhook3 = { ...element.manifest.options.webhook3.default };
                } else {
                  element.options.webhook2 = { ...element.manifest.options.webhook2.default };
                }
              } else if (options.removeWebhook === 3) {
                element.options.webhook3 = { ...element.manifest.options.webhook3.default };
              }
            });
          }
          if (options.hasOwnProperty('emailAddress')) {
            element.options.emailAddress = options.emailAddress;
          }
          if (options.animation) {
            formUpdateIn(element, options);
            formUpdateOut(element, options);
          }
        }
      },
    };
  },
  {
    displayName: 'List Builder',
    options: {
      [START]: {
        type: FIELD_TEXT,
        label: 'In',
        units: 'seconds',
      },
      [END]: {
        type: FIELD_TEXT,
        units: 'seconds',
        hidden: true,
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
        default: 'WANT TO PERSONALIZE YOUR VIDEO EXPERIENCE '
            + 'CONFIRM YOUR INFO BELOW',
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
          id: 0,
          name: INPUT_VALUE,
        }],
      },
      [PRIVACY_DISCLAIMER]: {
        name: PRIVACY_DISCLAIMER,
        type: 'textarea',
        label: 'Privacy Disclaimer',
        default: 'By opting in you are giving us permission to reach out to you concerning this service. We will not share your information or spam.',
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
        default: 'Bevan',
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
        default: 100,
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
        type: BLUR_ENTER_INPUT,
        label: 'Webhook Address',
        default: '',
        className: 'input-field-container',
      },
      webhook2: {
        name: 'webhook2',
        type: BLUR_ENTER_INPUT,
        label: 'Webhook Address 2',
        default: { hidden: true, value: '' },
        className: 'item-form',
      },
      webhook3: {
        name: 'webhook3',
        type: BLUR_ENTER_INPUT,
        label: 'Webhook Address 3',
        default: { hidden: true, value: '' },
        className: 'item-form',
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
        name: EMAIL_ADDRESS,
        type: 'email',
        label: 'Notification Address',
        caretField: 'urlCaretOffset',
        default: '',
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
