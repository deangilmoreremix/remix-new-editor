import { extendObservable } from 'mobx';
import fonts from '../../../constants/fonts';
import {
  ELEMENTS_LEAD_GENERATOR,
  TRANSITIONS_LEAD_GENERATOR,
  INPUT_VALUE,
} from '../../../constants/settings/lead-generator';
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
(function (Popcorn) {
  const BASIC_TOKEN = 'WEZLdFZhcnRiSllNNzJTNTo0ajRZdEV1QmEyYmFxckRN';
  const DEFAULT_INPUT_FONT_COLOR = '#000000';
  const DEFAULT_FORM_FONT_COLOR = '#ffffff';
  const DEFAULT_BACKGROUND_COLOR = '#000000';
  const DEFAULT_INNER_FONT_COLOR = '#ffffff';
  const DEFAULT_BUTTON_BACKGROUND_COLOR = '#eb5054';
  const DEFAULT_BUTTON_FONT_COLOR = '#ffffff';
  const DEFAULT_BUTTON_BOTTOM_BORDER_COLOR = '#c85135';
  const DEFAULT_BUTTON_BORDER_RADIUS = '1';
  // eslint-disable-next-line no-useless-escape
  const EMAIL_REGEX = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  // eslint-disable-next-line no-useless-escape
  const WEBHOOK_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/;
  const PHONE_REGEX = /^(\+[0-9\s]*-?)?(\([0-9\s]*\))?[0-9-.\s]{10,14}$/;

  Popcorn.plugin('form', () => {
      let popcorn;

      function isMobile() {
        return navigator.userAgent.match(/(iPad|iPhone|iPod|Android)/g);
      }

      function create(type) {
        return document.createElement(type);
      }

      function rgb2hex(rgb) {
        rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
        return (rgb && rgb.length === 4) ? `#${
          (`0${parseInt(rgb[1], 10).toString(16)}`).slice(-2)
        }${(`0${parseInt(rgb[2], 10).toString(16)}`).slice(-2)
        }${(`0${parseInt(rgb[3], 10).toString(16)}`).slice(-2)}` : '';
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

      function validateValues(regexp, value) {
        let isValid = true;
        value.split(',').map((item) => item.trim()).forEach((item) => {
          if (!regexp.test(item)) {
            isValid = false;
          }
        });
        return isValid;
      }

      function buildFormSubmission(form) {
        const result = {};
        for (let i = 0; i < form.elements.length; i++) {
          const element = form.elements[i];
          if (element.type === 'hidden' || !element.value || !element.getAttribute('name')) {
            // eslint-disable-next-line no-continue
            continue;
          }
          result[element.getAttribute('name')] = element.value;
        }
        return result;
      }

      function validateFormSubmission(options, submission) {
        const nonemptyValidator = function (val) {
          if (val && val.length > 0) {
            return null;
          }
          return 'value can\'t be empty';
        };
        const validators = {
          singleline: nonemptyValidator,
          multiline: nonemptyValidator,
          email(val) {
            if (nonemptyValidator(val)) {
              return nonemptyValidator(val);
            }
            if (!EMAIL_REGEX.test(val)) {
              return 'email format is invalid';
            }
          },
          number(val) {
            if (nonemptyValidator(val) || !/^[0-9]*$/.test(val)) {
              return 'value is not a valid number';
            }
          },
          date: nonemptyValidator,
        };

        let validationMessage = null;
        options.elements.forEach((element) => {
          const result = validators[element.type](submission[element.token]);
          if (result) {
            validationMessage = `Validation failed for ${element.label}: ${result}`;
          }
        });
        return validationMessage;
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
          inner.style.background = getRgba(options.innerColor,
            options.innerOpacity);
        }

        if (options.innerColor) {
          options.innerColor = rgb2hex(options.innerColor);
          inner.style.background = getRgba(options.innerColor,
            options.innerOpacity);
        }
        const formScrollable = document.createElement('div');
        formScrollable.classList.add('form-scrollable');
        formScrollable.style.width = '70%';

        const formScrollableInner = document.createElement('div');
        formScrollableInner.classList.add('form-scrollable-inner');

        if (options.brandLogoSrc) {
          const brandLogoHandle = document.createElement('img');
          brandLogoHandle.classList.add('brand-logo');
          brandLogoHandle.setAttribute('src', options.brandLogoSrc);
          formScrollableInner.appendChild(brandLogoHandle);
        }

        const fontSheet = document.createElement('link');
        fontSheet.rel = 'stylesheet';
        fontSheet.type = 'text/css';
        options._fontSheet = fontSheet;
        fontSheet.onload = function () {
          options._container.style.fontFamily = options.fontFamily;
          options._container.querySelectorAll('button').forEach((item) => {
            item.style.fontFamily = options.fontFamily;
          });
        };

        fontSheet.href = `https://fonts.googleapis.com/css?family=${
          options.fontFamily.replace(/\s/g, '+')}:400,700`;
        document.head.appendChild(fontSheet);

        const captionHandle = document.createElement('div');
        captionHandle.classList.add('retarget-caption');
        captionHandle.innerText = typeof (options.caption) !== 'undefined'
          ? options.caption : options._natives.manifest.options.caption.default;
        captionHandle.style.fontSize = `${options.captionFontSize
        || options.fontSize}%`;
        captionHandle.style.textAlign = options.captionAlignment;
        formScrollableInner.appendChild(captionHandle);
        captionHandle.style.marginBottom = '0.5em';

        const inputWrapper = document.createElement('div');
        inputWrapper.classList.add('input-wrapper');

        options.elements.forEach((declaration) => {
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
          inputWrapper.querySelector('input').style.marginBottom = '1em';
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
          formScrollableInner.appendChild(disclaimerHandle);
        }

        if (options.privacyPolicyCaption
          && options.privacyPolicyLink) {
          const privacyLinkHandle = document.createElement('a');
          privacyLinkHandle.classList.add('privacy-policy-link');
          privacyLinkHandle.innerText = options.privacyPolicyCaption;
          privacyLinkHandle.setAttribute('href', options.privacyPolicyLink);
          privacyLinkHandle.setAttribute('target', '_blank');
          formScrollableInner.appendChild(privacyLinkHandle);
        }

        formScrollable.appendChild(formScrollableInner);
        inner.appendChild(formScrollable);
        form.appendChild(inner);
        if (options.enableSkipButton) {
          form.appendChild(skipButton);
        }
        form.classList.add('popcorn');
        form.classList.add('retarget-form');
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
            getRgba(options.backgroundColor, 7)
          } 10%,${getRgba(options.backgroundColor, 80)} 90%,${
            getRgba(options.backgroundColor, 100)} 100%)`;
        }
        form.style.backgroundSize = 'cover';
        ['button', 'input', 'textarea'].forEach((type) => {
          form.querySelectorAll(type).forEach((item) => {
            item.style.fontSize = `${+options.fontSize + (isMobile() ? 50 : 0)}%`;
          });
        });
        form.style.color = options.fontColor;

        form.onsubmit = function () {
          return false;
        };
        ['.buttons-inner > button'].forEach((selector) => {
          form.querySelectorAll(selector).forEach((item) => {
            item.style.width = '100%';
            item.style.boxSizing = 'border-box';
            item.style.borderColor = 'transparent';
            item.style.boxShadow = '0px 1px 1px 0px rgba(0, 0, 0, 0.5)';
            if (options.btnBottomBorder) {
              item.style.borderBottom = `1px solid ${
                getRgba(options.btnBottomBorder, 100)}`;
            }
            item.style.background = options.buttonBackground
              ? getRgba(options.buttonBackground, 100)
              : DEFAULT_BUTTON_BACKGROUND_COLOR;
            item.style.borderRadius = `${options.buttonBorderRadius}px`;
            item.style.color = options.buttonFontColor;
          });
        });

        submitButton.addEventListener('click', () => {
          if (!document.querySelector('meta[name=project]')) {
            return;
          }
          const makeId = JSON.parse(document.querySelector('meta[name=project]').content).id;
          const formData = buildFormSubmission(form);
          const validationMessage = validateFormSubmission(options, formData);
          if (validationMessage) {
            return alert(validationMessage);
          }
          const analyticsWriteKey = document.querySelector('meta[property=analyticsWriteKey]').content;
          const optinXhr = new XMLHttpRequest();
          const OPTIN_ENDPOINT = `//dev-api.vidcloud.io/api/makes/${makeId}/opt-in`;
          optinXhr.open('POST', OPTIN_ENDPOINT);
          optinXhr.setRequestHeader('Authorization', `Basic ${analyticsWriteKey}`);
          optinXhr.setRequestHeader('Content-Type', 'application/json');
          optinXhr.send(JSON.stringify({
            data: formData,
            source: 'list builder',
          }));
          if (options.webhookEnabled
            && options.webhook
            && validateValues(WEBHOOK_REGEX, options.webhook)) {
            const webhookXhr = new XMLHttpRequest();
            webhookXhr.open('POST', options.webhook);
            webhookXhr.send(JSON.stringify(formData));
          }
          if (options.emailEnabled
            && options.emailAddress
            && validateValues(EMAIL_REGEX, options.emailAddress)) {
            const emailXhr = new XMLHttpRequest();
            if (document.querySelector('meta[name=project]')) {
              const LEAD_ENDPOINT = `//dev-api.vidcloud.io/api/makes/${makeId}/lead`;
              emailXhr.open('POST', LEAD_ENDPOINT);
              emailXhr.setRequestHeader('Authorization', `Basic ${BASIC_TOKEN}`);
              emailXhr.setRequestHeader('Content-Type', 'application/json');
              emailXhr.send(JSON.stringify({
                to: options.emailAddress,
                data: formData,
              }));
            }
          }
          const { vidcloud } = window;
          if ((vidcloud && vidcloud.config.clickToPhoneCall)
            && options.dialEnabled
            && options.phone
            && validateValues(PHONE_REGEX, options.phone)) {
            if (options.callNotifyAddress) {
              if (window.confirm('By clicking here you agree to give this business access to your basic information in order to notify them that you attempted to make a call.\n'
                + 'They will receive your name, email address and gender.')) {
                const notifyXhr = new XMLHttpRequest();
                // eslint-disable-next-line no-shadow
                const personalizedTokens = window.digistrats
                  ? window.digistrats.getPersonalizedTokens(true)
                  : {};
                if (document.querySelector('meta[name=project]')) {
                  const NOTIFY_ENDPOINT = `//dev-api.vidcloud.io/api/makes/${makeId}/notify`;
                  notifyXhr.open('POST', NOTIFY_ENDPOINT);
                  notifyXhr.setRequestHeader('Authorization', `Basic ${BASIC_TOKEN}`);
                  notifyXhr.setRequestHeader('Content-Type', 'application/json');
                  notifyXhr.send(JSON.stringify({
                    to: options.callNotifyAddress,
                    type: 'phoneCallAttempt',
                    data: {
                      FIRSTNAME: personalizedTokens.FIRSTNAME,
                      LASTNAME: personalizedTokens.LASTNAME,
                      EMAIL: personalizedTokens.EMAIL,
                      GENDER: personalizedTokens.GENDER,
                    },
                  }));
                }
                window.open(`tel://${options.phone}`);
              }
            } else {
              window.open(`tel://${options.phone}`);
            }
          }
          options._submitted = true;
          options._formData = formData;
          return resumePlayback(options);
        });

        return form;
      }

      function buildScripts(options, manifest) {
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
            options.scripts._compiled[key] = function () {
              return fn.apply(fn, [{
                event: options,
              }]);
            };
          });
        }
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
          const transition = options.transition
            || options._natives.manifest.options.transition.default;

          popcorn = this;

          function fillOption(optionName) {
            if (!options[optionName]) {
              options[optionName] = options._natives.manifest.options[optionName].default;
            }
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
          outer.style.position = 'absolute';
          outer.style.background = 'rgba(62, 62, 81, 0.67)';
          outer.classList.add('retarget-outer-container');
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

          options._transitionContainer.classList.add(transition);
          options._transitionContainer.classList.add('off');

          options.toString = function () {
            return 'Lead Generator';
          };

          buildScripts(options);

          extendObservable(options, {
            _container: elementContainer,
            _transitionContainer: options._transitionContainer,
          });
        },

        start(event, options) {
          if (options._submitted) {
            return;
          }
          const container = options._container;
          const transitionContainer = options._transitionContainer;

          container.style.zIndex = '1299';
          container.style.display = 'flex';
          if (container) {
            container.style.visibility = 'visible';

            // Safari Redraw hack - #3066
            container.style.display = 'none';
            container.style.display = '';
          }

          if (transitionContainer) {
            // Safari Redraw hack - #3066
            const safariHack = function () {
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

          if (options._transitionContainer) {
            options._transitionContainer.classList.remove('on');
            options._transitionContainer.classList.add('off');
          }

          if (options._container) {
            options._container.style.zIndex = '-9999';
            options._container.style.visibility = 'hidden';
          }

          buildScripts(options);
          if (options.scripts && options.scripts._compiled
            && options.scripts._compiled.onEnd) {
            options.scripts._compiled.onEnd();
          }
        },

        _teardown(options) {
          if (options._target && options._container) {
            options._target.removeChild(options._container);
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
              trackEvent.backgroundColor = rgb2hex(options.backgroundColor);
              form.style.background = `radial-gradient(circle, ${
                getRgba(options.backgroundColor, 7)} 10%,${
                getRgba(options.backgroundColor, 80)} 90%,${
                getRgba(options.backgroundColor, 100)} 100%)`;
            }
            if (options.hasOwnProperty('captionFontSize')) {
              trackEvent.captionFontSize = options.captionFontSize;
              form.querySelector('.retarget-caption').style.fontSize = `${options.captionFontSize}%`;
            }
            if (options.hasOwnProperty('captionAlignment')) {
              trackEvent.captionAlignment = options.captionAlignment;
              form.querySelector('.retarget-caption').style.textAlign = options.captionAlignment;
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
              trackEvent.innerColor = rgb2hex(options.innerColor);
              if (trackEvent.innerColor) {
                inner.style.background = getRgba(trackEvent.innerColor,
                  trackEvent.innerOpacity);
              }
            }
            if (options.hasOwnProperty('innerOpacity')) {
              trackEvent.innerOpacity = options.innerOpacity;
              if (trackEvent.innerColor) {
                inner.style.background = getRgba(trackEvent.innerColor,
                  options.innerOpacity);
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
              trackEvent.buttonBackground = rgb2hex(options.buttonBackground);
              ['.buttons-inner > button'].forEach((selector) => {
                form.querySelectorAll(selector).forEach((item) => {
                  item.style.background = getRgba(options.buttonBackground, 100);
                });
              });
            }
            if (options.hasOwnProperty('buttonFontColor')) {
              trackEvent.buttonFontColor = rgb2hex(options.buttonFontColor);
              ['.buttons-inner > button'].forEach((selector) => {
                form.querySelectorAll(selector).forEach((item) => {
                  item.style.color = getRgba(options.buttonFontColor, 100);
                });
              });
            }
            if (options.hasOwnProperty('buttonBorderRadius')) {
             trackEvent.buttonBorderRadius = options.buttonBorderRadius;
              ['.buttons-inner > button'].forEach((selector) => {
                form.querySelectorAll(selector).forEach((item) => {
                  item.style.borderRadius = `${options.buttonBorderRadius}%`;
                });
              });
            }
            if (options.hasOwnProperty('btnBottomBorder')) {
              trackEvent.btnBottomBorder = rgb2hex(options.btnBottomBorder);
              ['.buttons-inner > button'].forEach((selector) => {
                form.querySelectorAll(selector).forEach((item) => {
                  item.style.borderBottom = `1px solid ${options.btnBottomBorder}`;
                });
              });
            }
            if (options.hasOwnProperty('fontColor')) {
              form.style.color = trackEvent.fontColor = options.fontColor;
              trackEvent._container.querySelectorAll('button').forEach((item) => {
                item.style.fontColor = rgb2hex(options.fontColor);
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
              fontSheet.onload = function () {
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
              trackEvent.webhook = options.webhook;
            }
            if (options.hasOwnProperty('emailAddress')) {
              trackEvent.emailAddress = options.emailAddress;
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
          type: 'input',
          label: 'Caption',
          default: 'WANT TO PERSONALIZE YOUR VIDEO EXPERIENCE '
            + 'CONFIRM YOUR INFO BELOW',
        },
        [ELEMENTS]: {
          name: ELEMENTS,
          type: 'select',
          items: ELEMENTS_LEAD_GENERATOR,
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
          name: [EMAIL_ADDRESS],
          type: 'email',
          label: 'Notification Address',
          caretField: 'urlCaretOffset',
        },
        [TRANSITION]: {
          name: TRANSITION,
          type: 'select',
          items: TRANSITIONS_LEAD_GENERATOR,
          label: 'Transition',
          default: 'popcorn-none',
        },
        [SCRIPTS]: {
          onStart: '',
          onEnd: '',
        },
      },
    });
}(window.Popcorn));
