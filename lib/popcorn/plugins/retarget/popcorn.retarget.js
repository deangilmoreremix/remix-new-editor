import { extendObservable } from 'mobx';
import fonts from '../../../constants/fonts';
import {
  ARRAY_ELEMENTS_RETARGET,
  ARRAY_TRANSITIONS,
  INPUT_VALUE,
} from '../../../constants/settings/retarget-settings';
import {
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
  const DEFAULT_BUTTON_BOTTOM_BORDER_COLOR = '#c85135';
  const DEFAULT_BUTTON_BORDER_RADIUS = '1';

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
        inner.style.background = getRgba(element.options.innerColor,
          element.options.innerOpacity);
      }
      const formScrollable = document.createElement('div');
      formScrollable.classList.add('form-scrollable');
      formScrollable.style.width = '70%';

      const formScrollableInner = document.createElement('div');
      formScrollableInner.classList.add('form-scrollable-inner');

      if (element.options.brandLogoSrc) {
        const brandLogoHandle = document.createElement('img');
        brandLogoHandle.classList.add('brand-logo');
        brandLogoHandle.setAttribute('src', element.options.brandLogoSrc);
        formScrollableInner.appendChild(brandLogoHandle);
      }

      const fontSheet = document.createElement('link');
      fontSheet.rel = 'stylesheet';
      fontSheet.type = 'text/css';
      element._fontSheet = fontSheet;
      fontSheet.onload = () => {
        element._container.style.fontFamily = element.options.fontFamily;
        element._container.querySelectorAll('button').forEach((item) => {
          item.style.fontFamily = element.fontFamily;
        });
      };

      fontSheet.href = `https://fonts.googleapis.com/css?family=${
        element.options.fontFamily.replace(/\s/g, '+')}:400,700`;
      document.head.appendChild(fontSheet);

      const captionHandle = document.createElement('div');
      captionHandle.classList.add('retarget-caption');
      captionHandle.innerText = typeof (element.options.caption) !== 'undefined'
        ? element.options.caption : element.manifest.options.caption.default;
      captionHandle.style.fontSize = `${element.options.captionFontSize
          || element.options.fontSize}%`;
      captionHandle.style.textAlign = element.options.captionAlignment;
      formScrollableInner.appendChild(captionHandle);
      captionHandle.style.marginBottom = '0.5em';

      const inputWrapper = document.createElement('div');
      inputWrapper.classList.add('input-wrapper');

      element.options.elements.forEach((declaration) => {
        let input;
        switch (declaration.type) {
          case 'singleline':
            input = document.createElement('input');
            input.setAttribute('type', 'text');
            input.setAttribute('maxlength', '80');
            break;
          case 'multiline':
            input = document.createElement('textarea');
            input.setAttribute('maxlength', '250');
            input.style.marginBottom = '0.5em';
            input.style.marginTop = '0.5em';
            input.style.paddingBottom = '3em';
            break;
          case 'email':
            input = document.createElement('input');
            input.setAttribute('type', 'email');
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
            break;
          case 'date':
            input = document.createElement('input');
            input.style['-webkit-appearance'] = 'none';
            input.style['-moz-appearance'] = 'none';
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

      const buttonsInner = document.createElement('div');
      buttonsInner.classList.add('buttons-inner');
      buttonsInner.style.width = 'auto';
      buttonsInner.style.flexGrow = '1';
      buttonsInner.style.display = 'grid';

      const submitButton = document.createElement('button');
      submitButton.innerText = typeof (element.options.btnText) !== 'undefined'
        ? element.options.btnText
        : 'Play';
      const wrapperContainer = document.createElement('div');
      wrapperContainer.classList.add('input-wrapper-container');
      wrapperContainer.appendChild(inputWrapper);
      buttonsInner.appendChild(submitButton);
      wrapperContainer.appendChild(buttonsInner);

      if (element.options.elements.length === 2) {
        wrapperContainer.style.flexDirection = 'column';
        inputWrapper.style.flexDirection = 'column';
        inputWrapper.style.width = '70%';
        inputWrapper.style.marginRight = '0';
        inputWrapper.querySelector('input').style.marginBottom = '1em';
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

      if (element.options.privacyDisclaimer) {
        const disclaimerHandle = document.createElement('div');
        disclaimerHandle.classList.add('privacy-disclaimer');
        disclaimerHandle.style.fontSize = '40%';
        disclaimerHandle.innerText = element.options.privacyDisclaimer;
        formScrollableInner.appendChild(disclaimerHandle);
      }

      if (element.options.privacyPolicyCaption
          && element.options.privacyPolicyLink) {
        const privacyLinkHandle = document.createElement('a');
        privacyLinkHandle.classList.add('privacy-policy-link');
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
        form.style.top = `${(100 - (element.height
            || element.manifest.options.height.default)) / 2.0}%`;
        form.style.left = `${(100 - (element.width
            || element.manifest.options.width.default)) / 2.0}%`;
        form.style.width = `${element.width
            || element.manifest.options.width.default}%`;
        form.style.height = `${element.height
            || element.manifest.options.height.default}%`;
      } else {
        form.style.width = form.style.height = '90%';
        form.style.top = form.style.left = '5%';
      }
      if (element.options.backgroundImage) {
        form.style.background = `url(${element.options.backgroundImage})`;
      } else if (element.options.backgroundColor) {
        form.style.background = `radial-gradient(circle, ${
          getRgba(element.options.backgroundColor, 7)
        } 10%,${getRgba(element.options.backgroundColor, 80)} 90%,${
          getRgba(element.options.backgroundColor, 100)} 100%)`;
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
          item.style.boxShadow = '0px 1px 1px 0px rgba(0, 0, 0, 0.5)';
          if (element.options.btnBottomBorder) {
            item.style.borderBottom = `1px solid ${
              getRgba(element.options.btnBottomBorder, 100)}`;
          }
          item.style.background = element.options.buttonBackground
            ? getRgba(element.options.buttonBackground, 100)
            : DEFAULT_BUTTON_BACKGROUND_COLOR;
          item.style.borderRadius = `${element.options.buttonBorderRadius}px`;
          item.style.color = element.options.buttonFontColor;
        });
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
        const transition = element.options.transition
              || element.manifest.options.transition.default;

        popcorn = this;

        function fillOption(optionName) {
          if (!element.options[optionName]) {
            element.options[optionName] = element.manifest.options[optionName].default;
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
          'buttonBackground', 'btnBottomBorder', 'fontFamily', 'buttonFontColor'].forEach(fillOption);

        elementContainer = outer = create('div');
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

        element.options.fontSize = element.options.fontSize
            || element.manifest.options.fontSize.default;

        element._transitionContainer = buildForm(element);
        outer.appendChild(element._transitionContainer);

        if (!isMobile()) {
          target.appendChild(elementContainer);
        } else {
          window.document.body.appendChild(elementContainer);
        }

        element._transitionContainer.classList.add(transition);
        element._transitionContainer.classList.add('off');

        element.options.toString = () => 'List Builder';

        buildScripts(element.options, element.manifest);

        extendObservable(element, {
          _container: elementContainer,
          _transitionContainer: element._transitionContainer,
        });
      },

      start(element) {
        if (element.options._submitted) {
          return;
        }
        const container = element._container;
        const transitionContainer = element._transitionContainer;

        container.style.zIndex = '1300';
        container.style.display = 'flex';
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

        popcorn.interactive = false;
        window.addEventListener('orientationchange', onOrientationChange);
      },

      end(element) {
        window.removeEventListener('orientationchange', onOrientationChange);
        popcorn.interactive = true;

        if (element._transitionContainer) {
          element._transitionContainer.classList.remove('on');
          element._transitionContainer.classList.add('off');
        }

        if (element._container) {
          element._container.style.zIndex = '-9999';
          element._container.style.visibility = 'hidden';
        }

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
              getRgba(element.options.backgroundColor, 7)} 10%,${
              getRgba(element.options.backgroundColor, 80)} 90%,${
              getRgba(element.options.backgroundColor, 100)} 100%)`;
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
              inner.style.background = getRgba(element.options.innerColor,
                element.options.innerOpacity);
            }
          }
          if (options.hasOwnProperty('innerOpacity')) {
            element.options.innerOpacity = options.innerOpacity;
            if (element.options.innerColor) {
              inner.style.background = getRgba(element.options.innerColor,
                options.innerOpacity);
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
                item.style.background = getRgba(element.options.buttonBackground, 100);
              });
            });
          }
          if (options.hasOwnProperty('buttonFontColor')) {
            element.options.buttonFontColor = options.buttonFontColor;
            ['.buttons-inner > button'].forEach((selector) => {
              form.querySelectorAll(selector).forEach((item) => {
                item.style.color = getRgba(element.options.buttonFontColor, 100);
              });
            });
          }
          if (options.hasOwnProperty('buttonBorderRadius')) {
            element.options.buttonBorderRadius = options.buttonBorderRadius;
            ['.buttons-inner > button'].forEach((selector) => {
              form.querySelectorAll(selector).forEach((item) => {
                item.style.borderRadius = `${options.buttonBorderRadius}%`;
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
              form.style.fontFamily = options.fontFamily;
              form.querySelectorAll('button').forEach((item) => {
                item.style.fontFamily = options.fontFamily;
              });
            };

            fontSheet.href = `https://fonts.googleapis.com/css?family=${
              options.fontFamily.replace(/\s/g, '+')}:400,700`;
            document.head.appendChild(fontSheet);
          }
          if (options.hasOwnProperty('webhook')) {
            element.options.webhook = options.webhook;
          }
          if (options.hasOwnProperty('emailAddress')) {
            element.options.emailAddress = options.emailAddress;
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
        type: 'input',
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
        type: 'input',
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
        type: 'number',
        label: 'Phone Number',
        caretField: 'urlCaretOffset',
        labelHint: true,
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
    },
  });
})(window.Popcorn);
