/* eslint-disable no-underscore-dangle,no-new-func,no-prototype-builtins */
const Sortable = require('sortablejs');
const { extendObservable } = require('mobx');

(function (Popcorn) {
  const DEFAULT_BACKGROUND_COLOR = '#000000';
  const DEFAULT_INPUT_COLOR = '#000000';
  const DEFAULT_FONT_COLOR = '#ffffff';
  const DEFAULT_INNER_COLOR = '#ffffff';
  const DEFAULT_BUTTON_BACKGROUND_COLOR = '#eb5054';
  const DEFAULT_BUTTON_FONT_COLOR = '#ffffff';
  const DEFAULT_BUTTON_BOTTOM_BORDER_COLOR = '#c85135';
  const DEFAULT_BUTTON_BORDER_RADIUS = '1';

  Popcorn.plugin('form', () => {
    let _popcorn;

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

    function buildForm(options) {
      let addFieldButton;

      const createDropDownItem = (name, declaration, parent) => {
        const button = document.createElement('button');
        button.innerText = name;
        if (declaration.type === name) {
          button.classList.add('active');
        }
        button.addEventListener('click', () => {
          if (options.elements[declaration.id].type !== name) {
            options.elements[declaration.id].type = name;
            options._context.emit('elementUpdated', {
              type: 'form',
              element: options,
              options: {
                elements: options.elements,
              },
            });
            options._natives._update(options, { elements: options.elements });
          }
          parent.classList.remove('show');
        });
        parent.appendChild(button);
      };
      const addInputElement = (declaration, index) => {
        if (!declaration) {
          return;
        }
        let input;
        const inputWrapper = document.createElement('div');
        const inputForm = document.createElement('div');
        const containerEditBtn = document.createElement('div');
        containerEditBtn.classList.add('container-edit-buttons');
        inputWrapper.classList.add('input-wrapper');
        inputForm.classList.add('input-form');
        declaration.id = index;

        const dragButton = document.createElement('button');
        dragButton.classList.add('action-button', 'drag-button');
        dragButton.appendChild(document.createElement('img'));

        const dropDownButton = document.createElement('button');
        dropDownButton.classList.add('dropdown-button');
        dropDownButton.classList.add('action-button');
        const dropDownContainer = document.createElement('div');
        const dropDownContent = document.createElement('div');
        dropDownContent.classList.add('dropdown');
        const dropDownItemNames = ['singleline', 'number', 'email', 'multiline', 'date'];
        dropDownItemNames.forEach(name => createDropDownItem(name, declaration, dropDownContent));

        dropDownContent.classList.add('dropdown-content');

        dropDownButton.addEventListener('click', () => {
          dropDownContent.classList.toggle('show');
        });
        dropDownContent.addEventListener('blur', () => {
          dropDownContent.classList.remove('show');
        });
        dropDownContainer.appendChild(dropDownContent);
        dropDownButton.appendChild(dropDownContainer);

        const createInput = () => {
          const item = document.createElement('input');
          item.setAttribute('maxlength', '80');
          item.setAttribute('placeholder', declaration.label);
          return item;
        };

        switch (declaration.type) {
          case 'number':
            input = createInput();
            input.setAttribute('type', 'number');
            break;
          case 'singleline':
          case 'email':
            input = createInput();
            input.setAttribute('type', 'text');
            break;
          case 'multiline':
            input = document.createElement('textarea');
            input.classList.add('textarea-field');
            input.setAttribute('maxlength', '250');
            input.setAttribute('placeholder', declaration.label);
            break;
          case 'date':
            input = document.createElement('input');
            input.style['-webkit-appearance'] = 'none';
            input.style['-moz-appearance'] = 'none';
            input.setAttribute('type', 'text');
            input.setAttribute('placeholder', declaration.label);
            break;
          default:
            break;
        }

        input.style.fontSize = `${+options.fontSize + (isMobile() ? 50 : 0)}%`;

        input.setAttribute('name', declaration.token);

        const inputEditButton = document.createElement('button');
        inputEditButton.classList.add('action-button', 'edit-button');
        inputEditButton.addEventListener('click', () => {
          if (!input.hasAttribute('contenteditable')) {
            input.setAttribute('contenteditable', '');
            input.value = input.placeholder;
            input.focus();
          }
        });
        input.addEventListener('blur', ({ target }) => {
          if (input.hasAttribute('contenteditable')) {
            input.removeAttribute('contenteditable');
            const value = target.value || 'Untitled';
            options.elements[declaration.id].label = value;
            options.elements[declaration.id].token = encodeURIComponent(value.trim().toUpperCase().split(' ').join('_'));
            input.placeholder = value;
            input.value = '';
            options._context.emit('elementUpdated', {
              type: 'form',
              element: options,
              options: {
                elements: options.elements,
              },
            });
          }
        });

        input.addEventListener('input', ({ target }) => {
          if (input.hasAttribute('contenteditable')) {
            input.placeholder = target.value;
          }
        });
        inputEditButton.appendChild(document.createElement('img'));

        const removeButton = document.createElement('button');
        removeButton.classList.add('action-button', 'input-remove');
        removeButton.addEventListener('click', () => {
          const deletedElements = options.elements.splice(declaration.id, 1);
          if (!deletedElements.length) {
            options.elements.pop();
          }
          options.elements = options.elements.map((item, i) => {
            item.id = i;
            return item;
          });
          const wrapper = removeButton.parentNode;
          wrapper.parentNode.removeChild(wrapper);
          options._context.emit('elementUpdated', {
            type: 'form',
            element: options,
            options: {
              elements: options.elements,
            },
          });
          options._natives._update(options, {
            elements: options.elements,
          });
          if (options.elements.length < 5 && addFieldButton) {
            addFieldButton.classList.remove('hide');
          }
        });
        inputForm.appendChild(dropDownButton);
        inputForm.appendChild(input);
        removeButton.appendChild(document.createElement('img'));

        containerEditBtn.appendChild(inputEditButton);
        containerEditBtn.appendChild(removeButton);

        containerEditBtn.appendChild(dragButton);
        inputForm.appendChild(containerEditBtn);
        inputWrapper.appendChild(inputForm);
        return inputWrapper;
      };

      const form = document.createElement('form');

      const inner = document.createElement('div');
      inner.classList.add('form-inner');

      if (!isMobile()) {
        inner.style.margin = '2% 5%';
      } else {
        inner.style.margin = 'auto';
        inner.style.height = '90%';
        inner.style.width = '90%';
        inner.style.minWidth = '90%';
      }
      if (options.innerColor) {
        inner.style.background = `rgba(${
          parseInt(options.innerColor.substring(1, 3), 16)},${
          parseInt(options.innerColor.substring(3, 5), 16)},${
          parseInt(options.innerColor.substring(5, 7), 16)
        }, ${options.innerOpacity / 100.0})`;
      }

      const formScrollable = document.createElement('div');
      formScrollable.classList.add('form-scrollable');

      const formScrollableInner = document.createElement('div');
      formScrollableInner.classList.add('form-scrollable-inner');

      if (options.brandLogoSrc) {
        const brandLogoHandle = document.createElement('img');
        brandLogoHandle.classList.add('brand-logo');
        brandLogoHandle.setAttribute('src', options.brandLogoSrc);
        formScrollableInner.appendChild(brandLogoHandle);
      }

      const captionHandle = document.createElement('div');
      captionHandle.classList.add('lead-form-caption');

      const captionContainer = document.createElement('span');
      captionContainer.innerText = options.caption;

      const captionEditButton = document.createElement('button');
      captionEditButton.classList.add('action-button', 'small-edit-button');
      captionEditButton.addEventListener('click', () => {
        if (captionContainer.hasAttribute('contenteditable')) {
          captionContainer.removeAttribute('contenteditable');
          options._context.emit('elementUpdated', {
            type: 'form',
            element: options,
            options: {
              caption: captionContainer.innerText,
            },
          });
          options.caption = captionContainer.innerText;
        } else {
          captionContainer.setAttribute('contenteditable', '');
          captionContainer.focus();
        }
      });
      captionContainer.addEventListener('click', () => {
        captionContainer.setAttribute('contenteditable', '');
        captionContainer.focus();
      });
      captionContainer.addEventListener('blur', () => {
        captionContainer.removeAttribute('contenteditable');
        options._context.emit('elementUpdated', {
          type: 'form',
          element: options,
          options: {
            caption: captionContainer.innerText,
          },
        });
        options.caption = captionContainer.innerText;
      });
      captionEditButton.appendChild(document.createElement('img'));
      captionHandle.appendChild(captionContainer);
      captionHandle.appendChild(captionEditButton);

      captionHandle.style.fontSize = `${options.captionFontSize || options.fontSize}%`;
      captionHandle.style.fontColor = options.fontColor;
      captionHandle.style.textAlign = options.captionAlignment
        || options._natives.manifest.options.captionAlignment.default;
      formScrollableInner.appendChild(captionHandle);

      const wrapperContainer = document.createElement('div');
      wrapperContainer.classList.add('input-wrapper-container');

      const formElementContainer = document.createElement('div');
      options.elements.forEach((declaration, index) => formElementContainer
        .appendChild(addInputElement(declaration, index)));

      formElementContainer.style.display = 'flex';
      formElementContainer.style.justifyContent = 'space-between';
      formElementContainer.style.color = DEFAULT_INPUT_COLOR;
      Sortable.create(formElementContainer, {
        animation: 150,
        forceFallback: true,
        onEnd: (event) => {
          const { oldIndex, newIndex } = event;
          if (newIndex !== oldIndex) {
            const [element] = options.elements.splice(oldIndex, 1);
            options.elements.splice(newIndex, 0, element);
            options._context.emit('elementUpdated', {
              type: 'form',
              element: options,
              options: {
                elements: options.elements,
              },
            });
            options._natives._update(options, {
              elements: options.elements,
            });
          }
        },
      });

      const loader = document.createElement('div');
      loader.classList.add('loader', 'hide', 'input-add');
      addFieldButton = document.createElement('button');
      addFieldButton.classList.add('action-button');
      addFieldButton.classList.add('input-add');
      addFieldButton.classList.add('loading');
      addFieldButton.innerText = '+ Add Field';
      addFieldButton.addEventListener('click', () => {
        addFieldButton.classList.add('hide');
        loader.classList.remove('hide');
        const newElement = {
          type: 'singleline',
          label: 'Untitled',
          token: 'UNTITLED',
        };
        options.elements.push(newElement);
        formElementContainer
          .appendChild(addInputElement(newElement, options.elements.length - 1));
        options._natives._update(options, {
          elements: options.elements,
        });
        options._context.emit('elementUpdated', {
          type: 'form',
          element: options,
          options: {
            elements: options.elements,
          },
        });
        loader.classList.add('hide');
        if (options.elements.length < 5) {
          addFieldButton.classList.remove('hide');
        }
      });

      formScrollableInner.appendChild(addFieldButton);
      wrapperContainer.appendChild(formElementContainer);
      wrapperContainer.appendChild(loader);

      if (options.elements.length >= 5) {
        addFieldButton.classList.add('hide');
      }

      const divButton = document.createElement('div');
      divButton.classList.add('div-button');

      divButton.classList.add('confirm-button');
      const buttonText = document.createElement('span');
      buttonText.innerText = options.btnText || 'Play';
      const submitEditButton = document.createElement('button');
      submitEditButton.classList.add('action-button', 'white-edit-button');
      submitEditButton.addEventListener('click', () => {
        if (buttonText.hasAttribute('contenteditable')) {
          buttonText.removeAttribute('contenteditable');
          options.btnText = buttonText.innerText;
          options._context.emit('elementUpdated', {
            type: 'form',
            element: options,
            options: {
              btnText: buttonText.innerText,
            },
          });
        } else {
          buttonText.setAttribute('contenteditable', '');
          buttonText.focus();
        }
      });
      buttonText.addEventListener('blur', () => {
        if (buttonText.hasAttribute('contenteditable')) {
          buttonText.removeAttribute('contenteditable');
          options.btnText = buttonText.innerText;
          options._context.emit('elementUpdated', {
            type: 'form',
            element: options,
            options: {
              btnText: buttonText.innerText,
            },
          });
        }
      });
      submitEditButton.appendChild(document.createElement('img'));

      divButton.appendChild(buttonText);
      divButton.appendChild(submitEditButton);

      wrapperContainer.appendChild(divButton);
      if (options.elements.length === 1) {
        wrapperContainer.style.height = '2em';
        formElementContainer.style.flexGrow = '4';
        formElementContainer.style.marginRight = '0.5em';
      } else if (options.elements.length === 2) {
        wrapperContainer.style.flexDirection = 'column';
        formElementContainer.style.flexDirection = 'column';
        formElementContainer.style.width = '70%';
        divButton.style.width = '70%';
        divButton.style.padding = '0 2%';
      } else if (options.elements.length === 3) {
        formElementContainer.style.flexWrap = 'wrap';
        formElementContainer.style.alignItems = 'center';
        formElementContainer.style.display = 'flex';
        formElementContainer.style.width = '100%';
        wrapperContainer.style.flexDirection = 'column';
        for (let i = 0; i < formElementContainer.childNodes.length - 1; i += 1) {
          formElementContainer.childNodes[i].style.width = '49%';
        }
        formElementContainer.childNodes[2].style.width = '10%';
        formElementContainer.childNodes[2].style.flexGrow = '5';
        formElementContainer.childNodes[2].style.marginRight = '0.5em';
        divButton.style.width = 'auto';
        divButton.style.height = '2em';
        formElementContainer.appendChild(divButton);
      } else if (options.elements.length === 4) {
        wrapperContainer.style.flexDirection = 'column';
        formElementContainer.style.flexWrap = 'wrap';
        formElementContainer.style.alignItems = 'center';
        formElementContainer.style.display = 'flex';
        formElementContainer.style.width = '100%';
        divButton.style.maxWidth = '100%';
        divButton.style.padding = '0 2%';
        for (let j = 0; j < formElementContainer.childNodes.length; j += 1) {
          formElementContainer.childNodes[j].style.width = '49%';
        }
      } else if (options.elements.length === 5) {
        formElementContainer.style.flexDirection = 'column';
        for (let k = 0; k < formElementContainer.childNodes.length - 1; k += 1) {
          formElementContainer.childNodes[k].style.marginBottom = '0.5em';
        }
        formElementContainer.style.width = '80%';
        divButton.style.maxWidth = '100%';
        divButton.style.boxSizing = 'border-box';
        divButton.style.padding = '0 2%';
        wrapperContainer.style.justifyContent = 'center';
        formElementContainer.appendChild(divButton);
      }
      formScrollableInner.appendChild(wrapperContainer);

      const disclaimerHandle = document.createElement('div');
      disclaimerHandle.classList.add('privacy-disclaimer');

      const disclaimerContainer = document.createElement('span');
      disclaimerContainer.innerText = options.privacyDisclaimer;

      const disclaimerEditButton = document.createElement('button');
      disclaimerEditButton.classList.add('action-button', 'small-edit-button');
      disclaimerEditButton.addEventListener('click', () => {
        if (disclaimerContainer.hasAttribute('contenteditable')) {
          disclaimerContainer.removeAttribute('contenteditable');
          options._context.emit('elementUpdated', {
            type: 'form',
            element: options,
            options: {
              privacyDisclaimer: disclaimerContainer.innerText,
            },
          });
          options.privacyDisclaimer = disclaimerContainer.innerText;
        } else {
          disclaimerContainer.setAttribute('contenteditable', '');
          disclaimerContainer.focus();
        }
      });
      disclaimerContainer.addEventListener('click', () => {
        disclaimerContainer.setAttribute('contenteditable', '');
        disclaimerContainer.focus();
      });
      disclaimerContainer.addEventListener('blur', () => {
        disclaimerContainer.removeAttribute('contenteditable');
        options._context.emit('elementUpdated', {
          type: 'form',
          element: options,
          options: {
            privacyDisclaimer: disclaimerContainer.innerText,
          },
        });
        options.privacyDisclaimer = disclaimerContainer.innerText;
      });
      disclaimerEditButton.appendChild(document.createElement('img'));
      disclaimerHandle.appendChild(disclaimerContainer);
      disclaimerHandle.appendChild(disclaimerEditButton);
      formScrollableInner.appendChild(disclaimerHandle);

      const privacyContainer = document.createElement('div');

      const privacyEditContainer = document.createElement('div');
      const privacyLinkInput = document.createElement('input');
      privacyEditContainer.classList.add('hide');
      privacyLinkInput.placeholder = 'Privacy Policy Link';
      privacyLinkInput.value = options.privacyPolicyLink || '';
      const privacyCaptionInput = document.createElement('input');
      privacyCaptionInput.placeholder = 'Privacy Policy Label';
      privacyCaptionInput.value = options.privacyPolicyCaption || '';

      privacyEditContainer.appendChild(privacyLinkInput);
      privacyEditContainer.appendChild(privacyCaptionInput);

      const privacyShowContainer = document.createElement('div');

      const privacyEditButton = document.createElement('button');
      privacyEditButton.classList.add('action-button', 'small-edit-button');

      const editPrivacy = () => {
        if (privacyEditContainer.hasAttribute('contenteditable')) {
          privacyEditContainer.removeAttribute('contenteditable');
          privacyEditContainer.classList.add('hide');
          if (options.privacyPolicyCaption !== privacyCaptionInput.value
            || options.privacyPolicyLink !== privacyLinkInput.value) {
            options._context.emit('elementUpdated', {
              type: 'form',
              element: options,
              options: {
                privacyPolicyCaption: privacyCaptionInput.value,
                privacyPolicyLink: privacyLinkInput.value,
              },
            });
            options._natives._update(options, {
              privacyPolicyCaption: privacyCaptionInput.value,
              privacyPolicyLink: privacyLinkInput.value,
            });
          }
        } else {
          privacyEditContainer.classList.remove('hide');
          privacyEditContainer.setAttribute('contenteditable', '');
          privacyEditContainer.focus();
        }
      };


      privacyEditButton.addEventListener('click', editPrivacy);
      form.addEventListener('blur', () => {
        if (privacyEditContainer.hasAttribute('contenteditable')) {
          privacyEditContainer.removeAttribute('contenteditable');
          privacyEditContainer.classList.add('hide');
          if (options.privacyPolicyCaption !== privacyCaptionInput.value
            || options.privacyPolicyLink !== privacyLinkInput.value) {
            options._context.emit('elementUpdated', {
              type: 'form',
              element: options,
              options: {
                privacyPolicyCaption: privacyCaptionInput.value,
                privacyPolicyLink: privacyLinkInput.value,
              },
            });
            options._natives._update(options, {
              privacyPolicyCaption: privacyCaptionInput.value,
              privacyPolicyLink: privacyLinkInput.value,
            });
          }
        }
      });

      privacyEditButton.appendChild(document.createElement('img'));

      privacyContainer.appendChild(privacyEditContainer);

      if (options.privacyPolicyCaption && options.privacyPolicyLink) {
        const privacyLinkHandle = document.createElement('a');
        privacyLinkHandle.classList.add('privacy-policy-link');
        privacyLinkHandle.innerText = options.privacyPolicyCaption;
        privacyLinkHandle.setAttribute('href', options.privacyPolicyLink);
        privacyShowContainer.appendChild(privacyLinkHandle);
      }

      privacyShowContainer.appendChild(privacyEditButton);
      privacyContainer.appendChild(privacyShowContainer);

      formScrollableInner.appendChild(privacyContainer);
      formScrollable.appendChild(formScrollableInner);
      inner.appendChild(formScrollable);
      form.appendChild(inner);
      form.classList.add('popcorn', 'lead-form');
      form.setAttribute('action', '#');

      if (isMobile()) {
        form.style.width = '90%';
        form.style.height = '90%';
        form.style.top = '5%';
        form.style.left = '5%';
      } else {
        form.style.top = `${(100 - (options.height || options._natives.manifest.options.height.default)) / 2.0}%`;
        form.style.left = `${(100 - (options._natives.manifest.options.width.default)) / 2.0}%`;
        form.style.width = `${options._natives.manifest.options.width.default}%`;
        form.style.height = `${options.height || options._natives.manifest.options.height.default}%`;
      }
      if (options.backgroundImage) {
        form.style.background = `url(${options.backgroundImage
        || options._natives.manifest.options.backgroundImage})`;
      } else if (options.backgroundColor) {
        form.style.background = `radial-gradient(circle, ${getRgba(options.backgroundColor, 7)
        } 44%,${getRgba(options.backgroundColor, 80)} 90%,${getRgba(options.backgroundColor, 100)}
         100%)`;
      }
      form.style.backgroundSize = 'cover';
      ['button', 'input', 'textarea'].forEach((type) => {
        form.querySelectorAll(type).forEach((item) => {
          item.style.fontSize = `${+options.fontSize + (isMobile() ? 50 : 0)}%`;
        });
      });
      form.style.color = options.fontColor;

      form.onsubmit = () => false;
      ['.confirm-button'].forEach((selector) => {
        form.querySelectorAll(selector).forEach((item) => {
          item.style.boxSizing = 'border-box';
          item.style.borderColor = 'transparent';
          item.style.boxShadow = '0px 1px 1px 0px rgba(0, 0, 0, 0.5)';
          if (options.btnBottomBorder) {
            item.style.borderBottom = `1px solid rgb(${
              parseInt(options.btnBottomBorder.substring(1, 3), 16)},${
              parseInt(options.btnBottomBorder.substring(3, 5), 16)},${
              parseInt(options.btnBottomBorder.substring(5, 7), 16)})`;
          }
          item.style.background = options.buttonBackground ? `rgb(${
            parseInt(options.buttonBackground.substring(1, 3), 16)},${
            parseInt(options.buttonBackground.substring(3, 5), 16)},${
            parseInt(options.buttonBackground.substring(5, 7), 16)})` : DEFAULT_BUTTON_BACKGROUND_COLOR;
          item.style.borderRadius = `${options.buttonBorderRadius}%`;
          item.style.color = options.buttonFontColor;
        });
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
          const fn = new Function('options', options.scripts[key]);
          options.scripts._compiled[key] = () => fn.apply(fn, [{
            event: options,
          }]);
        });
      }
    }

    function onOrientationChange() {
      if (document.activeElement.blur) {
        document.activeElement.blur();
      }
    }

    return {
      _setup(options) {
        const _this = this;
        const transition = options.transition
          || options._natives.manifest.options.transition.default;

        _popcorn = this;

        options._context = _popcorn;
        options._target = Popcorn.dom.find(options.target);

        const existsOptions = ['privacyDisclaimer', 'fontFamily', 'fontSize', 'innerOpacity',
          'fontColor', 'webhook', 'webhookEnabled', 'buttonBackground', 'buttonFontColor',
          'emailAddress', 'emailEnabled', 'caption', 'captionAlignment', 'innerWidth',
          'innerHeight', 'innerColor', 'buttonBorderRadius',
          'target', 'zindex', 'width', 'height', 'captionFontSize',
          'backgroundImage', 'btnBottomBorder', 'elements'];

        existsOptions.forEach((key) => {
          options[key] = options[key] || options._natives.manifest.options[key].default;
        });

        options.btnText = options.btnText || 'Play';

        if (!options._target) {
          return;
        }

        const _outer = create('div');
        _outer.style.position = 'absolute';
        _outer.style.background = 'rgba(0, 0, 0, 0.8)';
        _outer.classList.add('leadform-outer-container');
        _outer.style.visibility = 'hidden';
        _outer.style.width = '100%';
        _outer.style.height = '100%';
        _outer.style.top = '0';
        _outer.style.left = '0';
        _outer.style.zIndex = +options.zindex;
        options._container = _outer;

        options._transitionContainer = buildForm(options);
        _outer.appendChild(options._transitionContainer);

        if (!isMobile()) {
          options._target.appendChild(options._container);
        } else {
          window.document.body.appendChild(options._container);
        }

        options._transitionContainer.classList.add(transition);
        options._transitionContainer.classList.add('off');
        const fontSheet = document.createElement('link');
        fontSheet.rel = 'stylesheet';
        fontSheet.type = 'text/css';
        // Store reference to generated sheet for removal later, remove any existing ones
        options._fontSheet = fontSheet;
        fontSheet.onload = () => {
          _outer.style.fontFamily = options.fontFamily;
          _outer.querySelectorAll('button').forEach((item) => {
            item.style.fontFamily = options.fontFamily;
          });
        };

        fontSheet.href = `https://fonts.googleapis.com/css?family=${
          options.fontFamily.replace(/\s/g, '+')}:400,700`;
        document.head.appendChild(fontSheet);

        _outer.addEventListener('click', (event) => {
          event.stopPropagation();
          _this.emit('elementSelected', {
            element: options,
          });
        });

        options.toString = () => 'Lead Generator';

        extendObservable(options, {
          btnText: options.btnText,
          webhook: options.webhook,
          fontSize: options.fontSize,
          elements: options.elements,
          fontColor: options.fontColor,
          fontFamily: options.fontFamily,
          emailAddress: options.emailAddress,
          emailEnabled: options.emailEnabled,
          webhookEnabled: options.webhookEnabled,
          backgroundColor: options.backgroundColor,
          backgroundImage: options.backgroundImage,
        });

        buildScripts(options);
      },

      start(event, options) {
        if (options._submitted) {
          return;
        }
        const container = options._container;
        const transitionContainer = options._transitionContainer;

        container.style.zIndex = '9999';
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

          transitionContainer.classList.add('on');
          transitionContainer.classList.remove('off');

          if (['popcorn-fade', 'popcorn-slide-up', 'popcorn-slide-down'].indexOf(options.transition) === -1) {
            safariHack();
          } else {
            setTimeout(safariHack, 430);
          }
        }

        buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
          options.scripts._compiled.onStart();
        }

        _popcorn.interactive = false;
        setTimeout(() => {
          _popcorn.pause();
        }, 10);
        window.addEventListener('orientationchange', onOrientationChange);
      },

      end(event, options) {
        window.removeEventListener('orientationchange', onOrientationChange);
        _popcorn.interactive = true;

        if (options._transitionContainer) {
          options._transitionContainer.classList.remove('on');
          options._transitionContainer.classList.add('off');
        }

        if (options._container) {
          options._container.style.zIndex = '-9999';
          options._container.style.visibility = 'hidden';
        }

        buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
          options.scripts._compiled.onEnd();
        }
      },

      _teardown(options) {
        if (options._target && options._container) {
          options._target.removeChild(options._container);
        }
      },

      _update(trackEvent, options) {
        if (trackEvent._container) {
          const form = trackEvent._container.querySelector('form');
          Object.entries(options).forEach(([key, value]) => {
            if (value) {
              trackEvent[key] = value;
              switch (key) {
                case 'elements':
                case 'caption':
                case 'brandLogoSrc': {
                  trackEvent._container.removeChild(form);
                  trackEvent._transitionContainer = buildForm(trackEvent);
                  trackEvent._container.appendChild(trackEvent._transitionContainer);
                  break;
                }
                case 'fontColor': {
                  form.style.color = trackEvent.fontColor;
                  trackEvent._container.querySelectorAll('action-button').forEach((item) => {
                    item.style.backgroundColor = options.fontColor;
                  });
                  break;
                }
                case 'fontSize': {
                  ['button', 'input', 'textarea'].forEach((type) => {
                    form.querySelectorAll(type).forEach((item) => {
                      item.style.fontSize = `${options.fontSize}%`;
                    });
                  });
                  break;
                }
                case 'fontFamily': {
                  const fontSheet = document.createElement('link');
                  fontSheet.rel = 'stylesheet';
                  fontSheet.type = 'text/css';
                  // Store reference to generated sheet for removal later, remove any existing ones
                  trackEvent._fontSheet = fontSheet;
                  fontSheet.onload = () => {
                    form.style.fontFamily = `"${options.fontFamily}"`;
                    form.querySelectorAll('button').forEach((item) => {
                      item.style.fontFamily = options.fontFamily;
                    });
                  };

                  fontSheet.href = `https://fonts.googleapis.com/css?family=${
                    options.fontFamily.replace(/\s/g, '+')}:400,700`;
                  document.head.appendChild(fontSheet);
                  break;
                }
                default:
                  break;
              }
            }
          });

          if (options.privacyPolicyLink || options.privacyPolicyCaption) {
            trackEvent._container.removeChild(form);
            trackEvent._transitionContainer = buildForm(trackEvent);
            trackEvent._container.appendChild(trackEvent._transitionContainer);
          }
          if (options.backgroundImage) {
            form.style.background = `url(${options.backgroundImage}) no-repeat`;
            delete trackEvent.backgroundColor;
            form.style.backgroundColor = '';
          } else if (options.backgroundColor) {
            delete trackEvent.backgroundImage;
            form.style.background = `radial-gradient(circle, 
            ${getRgba(options.backgroundColor, 7)} 44%,${getRgba(options.backgroundColor, 80)}
             90%,${getRgba(options.backgroundColor, 100)} 100%)`;
          }
        }
      },
    };
  },
  {
    displayName: 'Lead Generator',
    options: {
      start: {
        elem: 'input',
        type: 'text',
        label: 'In',
        units: 'seconds',
      },
      end: {
        elem: 'input',
        type: 'text',
        units: 'seconds',
        hidden: true,
      },
      target: {
        hidden: true,
      },
      zindex: {
        hidden: true,
      },
      brandLogoSrc: {
        elem: 'input',
        type: 'url',
        label: 'Brand Logo URL',
      },
      caption: {
        elem: 'input',
        type: 'text',
        label: 'Caption',
        group: 'data',
        default: 'Please enter your details to view this video',
      },
      elements: {
        label: 'Elements',
        type: 'list',
        elem: 'sortable-list',
        group: 'data',
        default: [{
          type: 'email',
          label: 'Email',
          token: 'EMAIL',
        }],
      },
      privacyDisclaimer: {
        elem: 'input',
        type: 'text',
        label: 'Privacy Disclaimer',
        group: 'data',
        default: 'By opting in you are giving us permission to reach out to you concerning this service. We will not share your information or spam.',
      },
      privacyPolicyCaption: {
        elem: 'input',
        type: 'text',
        label: 'Privacy Policy Label',
        group: 'data',
      },
      privacyPolicyLink: {
        elem: 'input',
        type: 'text',
        label: 'Privacy Policy Link',
        group: 'data',
      },
      webhookEnabled: {
        elem: 'input',
        type: 'checkbox',
        label: 'Webhook Call',
        default: false,
        group: 'advanced',
      },
      webhook: {
        elem: 'input',
        type: 'text',
        label: 'Webhook Address',
        group: 'advanced',
      },
      emailEnabled: {
        elem: 'input',
        type: 'checkbox',
        label: 'Email Notification',
        default: false,
        group: 'advanced',
      },
      emailAddress: {
        elem: 'input',
        type: 'text',
        label: 'Notification Address',
        group: 'advanced',
      },
      width: {
        authorityLevel: 5,
        elem: 'input',
        type: 'number',
        units: '%',
        label: 'Width',
        default: 100,
      },
      height: {
        authorityLevel: 5,
        elem: 'input',
        type: 'number',
        units: '%',
        label: 'Height',
        default: 100,
      },
      fontFamily: {
        elem: 'select',
        label: 'Font',
        styleClass: '',
        googleFonts: true,
        default: 'Anton',
      },
      captionFontSize: {
        authorityLevel: 5,
        elem: 'input',
        type: 'number',
        label: 'Caption Font Size',
        units: '%',
      },
      captionAlignment: {
        authorityLevel: 5,
        elem: 'select',
        options: ['Center', 'Left', 'Right'],
        values: ['center', 'left', 'right'],
        label: 'Caption Alignment',
        default: 'center',
      },
      fontSize: {
        elem: 'input',
        type: 'number',
        label: 'Font Size',
        default: 80,
        units: '%',
      },
      fontColor: {
        elem: 'input',
        type: 'color',
        label: 'Font color',
        default: DEFAULT_FONT_COLOR,
      },
      innerWidth: {
        authorityLevel: 5,
        elem: 'input',
        type: 'number',
        units: '%',
        label: 'Inner Width',
        default: 90,
      },
      innerHeight: {
        authorityLevel: 5,
        elem: 'input',
        type: 'number',
        units: '%',
        label: 'Inner Height',
        default: 90,
      },
      innerColor: {
        authorityLevel: 5,
        elem: 'input',
        type: 'color',
        label: 'Inner Color',
        default: DEFAULT_INNER_COLOR,
      },
      innerOpacity: {
        authorityLevel: 5,
        elem: 'input',
        type: 'number',
        units: '%',
        label: 'Inner Opacity',
        default: 0,
      },
      backgroundImage: {
        elem: 'input',
        type: 'url',
        label: 'Background Source URL',
      },
      backgroundColor: {
        elem: 'input',
        type: 'color',
        label: 'Background color',
        default: DEFAULT_BACKGROUND_COLOR,
      },
      buttonBackground: {
        authorityLevel: 5,
        elem: 'input',
        type: 'color',
        label: 'Button Background color',
        default: DEFAULT_BUTTON_BACKGROUND_COLOR,
      },
      buttonFontColor: {
        authorityLevel: 5,
        elem: 'input',
        type: 'color',
        label: 'Button Font color',
        default: DEFAULT_BUTTON_FONT_COLOR,
      },
      buttonBorderRadius: {
        authorityLevel: 5,
        elem: 'input',
        type: 'number',
        label: 'Button border radius',
        default: DEFAULT_BUTTON_BORDER_RADIUS,
      },
      btnBottomBorder: {
        authorityLevel: 5,
        elem: 'input',
        type: 'color',
        label: 'Button Bottom Border color',
        default: DEFAULT_BUTTON_BOTTOM_BORDER_COLOR,
      },
      transition: {
        authorityLevel: 5,
        elem: 'select',
        options: ['None',
          'Pop',
          'Fade',
          'Fade In',
          'Fade In Up',
          'Slide Up',
          'Slide Down',
          'Swivel In (Y-axis)',
          'Swivel In (X-axis)',
          'Typing Effect',
          'Blur (White)',
          'Wobble Vertical',
          'Wobble Horizontal',
          'Wobble Diagonal',
          'Pulse (Looped)',
          'Push',
          'Bob',
          'Buzz',
          'Buzz out',
          'Stroke Pulse (Looped)',
          'Flicker',
          'Type Blink',
        ],

        values: ['popcorn-none',
          'popcorn-pop',
          'popcorn-fade',
          'popcorn-fade-in',
          'popcorn-fade-in-up',
          'popcorn-slide-up',
          'popcorn-slide-down',
          'popcorn-swivel-y',
          'popcorn-swivel-x',
          'popcorn-typing',
          'popcorn-blur-w',
          'popcorn-wobble-vertical',
          'popcorn-wobble-horizontal',
          'popcorn-wobble-diagonal',
          'popcorn-pulse',
          'popcorn-push',
          'popcorn-bob',
          'popcorn-buzz',
          'popcorn-buzz-out',
          'popcorn-stroke-pulse',
          'animate-flicker',
          'popcorn-type-blink',
        ],

        label: 'Transition',
        default: 'popcorn-fade-in',
      },
      scripts: {
        onStart: '',
        onEnd: '',
      },
    },
  });
}(window.Popcorn));
