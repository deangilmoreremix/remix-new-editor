// TODO: Refactor this to fit our needs!
/* eslint-disable no-underscore-dangle,no-new-func */
// PLUGIN: jsomAnimation

// const interact = require('interactjs');
const { extendObservable } = require('mobx');
const lottie = require('lottie-web');

// const { consts } = require('../../../../lib/consts/consts');

// const { callToActionFeature } = consts;
// const { callToActionFeature } = {};

function isSafari() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('safari') !== -1) {
    return ua.indexOf('chrome') === -1;
  }
  return false;
}

((Popcorn, jQuery) => {
  function updateDraggableResizable(element) {
    function setResizableHandles() {
      const positions = [
        { top: '48%', left: '-4px' },
        { top: '48%', right: '-4px' },
      ];
      element._container.querySelectorAll('.resize-handle').forEach((child) => {
        child.parentNode.removeChild(child);
      });
      positions.forEach((position) => {
        const handle = document.createElement('div');
        handle.classList.add('resize-handle');
        Object.keys(position).forEach((positionKey) => {
          handle.style[positionKey] = position[positionKey];
        });
        element._container.appendChild(handle);
      });
    }

    // const dragMoveListener = (event) => {
    //   const { target } = event;
    //   const x = (
    //     parseFloat(target.getAttribute('data-x')) || (element.left / 100)
    // * element._container.parentNode.offsetWidth
    //   )
    //     + (event.deltaRect ? event.deltaRect.left : event.dx);
    //   const y = (
    //     parseFloat(target.getAttribute('data-y')) || (element.top / 100)
    // * element._container.parentNode.offsetHeight
    //   )
    //     + (event.deltaRect ? event.deltaRect.top : event.dy);
    //
    //   const relativeTop = (
    //     y / element._container.parentNode.offsetHeight
    //   ) * 100;
    //   const relativeLeft = (
    //     x / element._container.parentNode.offsetWidth
    //   ) * 100;
    //   element.position = 'custom';
    //   element.top = relativeTop;
    //   element.left = relativeLeft;
    //   element._container.style.top = `${relativeTop}%`;
    //   element._container.style.left = `${relativeLeft}%`;
    //   if (event.rect) {
    //     const relativeHeight = (
    //       event.rect.height / element._container.parentNode.offsetHeight
    //     ) * 100;
    //     const relativeWidth = (
    //       event.rect.width / element._container.parentNode.offsetWidth
    //     ) * 100;
    //     element.width = relativeWidth;
    //     element._container.style.width = `${relativeWidth}%`;
    //     if (element.fontDecorations.responsive) {
    //       element.height = relativeHeight;
    //       element._container.style.height = `${relativeHeight}%`;
    //     }
    //     element._container.querySelector('.text-inner-div').style['overflow-y'] = 'auto';
    //   } else if (!element.fontDecorations.responsive) {
    //     element._container.querySelector('.text-inner-div').style['overflow-y'] = 'visible';
    //     element._container.style.maxHeight = `${100 - element.top}%`;
    //   }
    //
    //   target.setAttribute('data-x', x);
    //   target.setAttribute('data-y', y);
    //   if (['dragend', 'resizeend'].indexOf(event.type) !== -1) {
    //     element._context.emit('elementUpdated', {
    //       type: 'text',
    //       element,
    //       options: {
    //         top: element.top,
    //         left: element.left,
    //         width: element.width,
    //         height: element.height,
    //         position: 'custom',
    //       },
    //     });
    //     if (element.fontDecorations.responsive && textfill) {
    //       textfill();
    //     }
    //   }
    // };

    if (!element._interact) {
      // element._interact = interact(element._container);
    }
    // element._interact
    //   .draggable(options.draggable ? {
    //     onmove: dragMoveListener,
    //     onend: dragMoveListener,
    //     restrict: {
    //       restriction: 'parent',
    //       elementRect: { top: 0, left: 0, bottom: 1, right: 1 },
    //     },
    //   } : false)
    //   .resizable(options.resizable ? {
    //     // resize from all edges and corners
    //     edges: {
    //       left: true,
    //       right: true,
    //       bottom: element.fontDecorations.responsive,
    //       top: element.fontDecorations.responsive,
    //     },
    //
    //     // keep the edges inside the parent
    //     restrictEdges: {
    //       outer: 'parent',
    //       endOnly: true,
    //     },
    //     // minimum size
    //     restrictSize: {
    //       min: { width: 45, height: 45 },
    //     },
    //     inertia: true,
    //     onmove: dragMoveListener,
    //     onend: dragMoveListener,
    //   } : false);
    setResizableHandles();
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
        const fn = new Function('options', options.scripts[key]);
        options.scripts._compiled[key] = () => (fn.apply(fn, [{
          event: options,
        }]));
      });
    }
  }

  Popcorn.plugin('json-animation', {

    manifest: {
      about: {
        name: 'Popcorn JSON Animation Plugin',
        version: '0.1',
        author: 'dbaranoff',
      },
      options: {
        url: {
          elem: 'input',
          type: 'text',
          label: 'URL',
          group: 'basic',
          default: 'https://vremix-int.s3.amazonaws.com/resources/jsonTemplates/Simple_Lower_Third_13.json',
        },
        scale: {
          elem: 'input',
          label: 'Scale',
          group: 'basic',
          type: 'number',
          default: 100,
        },
        start: {
          elem: 'input',
          type: 'time',
          label: 'In',
          group: 'basic',
          units: 'seconds',
          default: 0,
        },
        end: {
          elem: 'input',
          type: 'time',
          label: 'Out',
          group: 'basic',
          units: 'seconds',
          default: 30,
        },
        left: {
          elem: 'input',
          type: 'number',
          label: 'Left',
          units: '%',
          default: 25,
          hidden: true,
        },
        top: {
          elem: 'input',
          type: 'number',
          label: 'Top',
          units: '%',
          default: 0,
          hidden: true,
        },
        width: {
          elem: 'input',
          type: 'number',
          units: '%',
          label: 'Width',
          default: 50,
          hidden: true,
        },
        height: {
          elem: 'input',
          type: 'number',
          units: '%',
          label: 'Height',
          default: 10,
          hidden: true,
        },
        zIndex: {
          default: 1000,
          hidden: true,
        },
        scripts: {
          onStart: '',
          onEnd: '',
        },
      },
    },

    _setup(options) {
      console.log('popcorn JSON _setup options', { ...options });
      let target = Popcorn.dom.find(options.target);
      const container = document.createElement('div');

      const context = this;

      options._container = container;
      options._context = context;

      if (!target) {
        target = this.media.parentNode;
      }

      options._target = target;
      container.style.position = 'absolute';
      container.style.left = '50%';
      container.style.top = '50%';
      container.style.width = '50%';
      container.style.height = '50%';
      container.style.backgroundColor = 'red';
      container.style.transform = 'translate(-50%, -50%)';
      container.style.zIndex = +options.zindex || options._natives.manifest.options.zindex.default;

      container.classList.add('popcorn-json-animation');

      context.on('elementSelected', (event) => {
        const { element } = event;

        if (options._container) {
          options._container.classList[element === options ? 'add' : 'remove']('active');
        }
        if (element !== options) {
          updateDraggableResizable(options, { draggable: true, resizable: true });
        }
      });

      options._container.addEventListener('click', (event) => {
        event.stopPropagation();
        context.emit('elementSelected', {
          element: options,
        });
      });

      buildScripts(options);

      updateDraggableResizable(options, { draggable: true, resizable: true });

      extendObservable(options, {
        url: options.url,
        scale: options.scale,
        start: options.start,
        end: options.end,
      });

      target.appendChild(container);
    },

    // TODO: showing on canvas
    start(event, options) {
      console.log('popcorn JSON start event', event);
      console.log('popcorn JSON start options', options);
      if (!isSafari()) {
        buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
          options.scripts._compiled.onStart();
        }
      } else {
        setTimeout(() => {
          buildScripts(options);
          if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
            options.scripts._compiled.onStart();
          }
        }, 430);
      }
    },

    // TODO: update settings in DB (trackEvents)
    _update(trackEvent, options) {
      console.log('popcorn JSON _update trackEvent', trackEvent);
      console.log('popcorn JSON _update options', options);
      if (options.scale !== undefined && +options.scale !== trackEvent.scale) {
        trackEvent.scale = +options.scale;
      }

      if (options.width !== undefined && options.width !== trackEvent.width) {
        trackEvent.width = options.width;
      }

      if (options.padding !== undefined && options.padding !== trackEvent.padding) {
        trackEvent.padding = options.padding;
      }

      if (options.zindex !== undefined && options.zindex !== trackEvent.zindex) {
        trackEvent.zindex = options.zindex;
      }

      trackEvent._context.on('elementSelected', (event) => {
        const { element } = event;

        if (trackEvent._container) {
          trackEvent._container.classList[element === trackEvent ? 'add' : 'remove']('active');
        }
      });
      trackEvent._container.addEventListener('click', (event) => {
        event.stopPropagation();
        // trackEvent._container.querySelector('*[contenteditable=""]').focus();
        trackEvent._context.emit('elementSelected', {
          element: trackEvent,
        });
      });

      trackEvent._container.style.left = `${trackEvent.left}%`;
      trackEvent._container.style.width = `${trackEvent.width}%`;
      trackEvent._container.style.top = `${trackEvent.top}%`;
      trackEvent._container.style.zIndex = +trackEvent.zindex;

      updateDraggableResizable(trackEvent, { draggable: true, resizable: true });
      console.log('popcorn JSON plugin _update finished', trackEvent);
    },

    end(event, options) {
      console.log('popcorn JSON end event', event);
      console.log('popcorn JSON end options', options);
      setTimeout(() => {
        if (options._transitionContainer) {
          options._transitionContainer.classList.remove('on');
          options._transitionContainer.classList.add('off');
        }

        buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
          options.scripts._compiled.onEnd();
        }
      }, 430);
    },

    _teardown(options) {
      console.log('popcorn JSON _teardown options', options);
      if (options._target) {
        options._target.removeChild(options._container);
      }
    },
  });
})(window.Popcorn, window.jQuery);
