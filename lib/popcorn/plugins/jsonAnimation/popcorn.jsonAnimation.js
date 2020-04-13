// TODO: This file will be updated in the following PR
//  please disregard the issues here
/* eslint-disable no-underscore-dangle,no-new-func */
// PLUGIN: jsomAnimation

const interact = require('interactjs');
const { extendObservable } = require('mobx');
const lottie = require('lottie-web');
const isEqual = require('lodash/isEqual');

const { getColors, setColors } = require('../../../lottie/utils');
const { getFormFields } = require('../../helpers');

function isSafari() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('safari') !== -1) {
    return ua.indexOf('chrome') === -1;
  }
  return false;
}
function draggableResizable(element) {
  function setResizableHandles() {
    const positions = [
      { top: '-4px', left: '-4px' },
      { top: '-4px', left: '48%' },
      { top: '-4px', right: '-4px' },
      { top: '48%', left: '-4px' },
      { top: '48%', right: '-4px' },
      { bottom: '-4px', left: '-4px' },
      { bottom: '-4px', left: '48%' },
      { bottom: '-4px', right: '-4px' },
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

  const dragMoveListener = (event) => {
    const { target } = event;
    const x = (
        parseFloat(target.getAttribute('data-x')) || (element.left / 100) *
        element._container.parentNode.offsetWidth
      )
      + (event.deltaRect ? event.deltaRect.left : event.dx);
    const y = (
        parseFloat(target.getAttribute('data-y')) || (element.top / 100) *
        element._container.parentNode.offsetHeight
      )
      + (event.deltaRect ? event.deltaRect.top : event.dy);

    const relativeTop = (
      y / element._container.parentNode.offsetHeight
    ) * 100;
    const relativeLeft = (
      x / element._container.parentNode.offsetWidth
    ) * 100;
    element.top = relativeTop;
    element.left = relativeLeft;
    element._container.style.top = `${relativeTop}%`;
    element._container.style.left = `${relativeLeft}%`;
    if (event.rect) {
      const relativeHeight = (
        event.rect.height / element._container.parentNode.offsetHeight
      ) * 100;
      const relativeWidth = (
        event.rect.width / element._container.parentNode.offsetWidth
      ) * 100;
      element.width = relativeWidth;
      element.height = relativeHeight;
      element._container.style.width = `${relativeWidth}%`;
      element._container.style.height = `${relativeHeight}%`;
    }

    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
    if (['dragend', 'resizeend'].indexOf(event.type) !== -1) {
      element._context.emit('elementUpdated', {
        type: 'image',
        element,
        options: {
          top: element.top,
          left: element.left,
          width: element.width,
          height: element.height,
        },
      });
    }
  };

  interact(element._container)
    .draggable({
      onmove: dragMoveListener,
      onend: dragMoveListener,
      restrict: {
        restriction: 'parent',
        elementRect: { top: 0, left: 0, bottom: 1, right: 1 },
      },
    })
    .resizable({
      // resize from all edges and corners
      edges: { left: true, right: true, bottom: true, top: true },

      // keep the edges inside the parent
      restrictEdges: {
        outer: 'parent',
        endOnly: true,
      },
      // minimum size
      restrictSize: {
        min: { width: 30, height: 30 },
      },
      inertia: true,
      onmove: dragMoveListener,
      onend: dragMoveListener,
    });
  setResizableHandles();
}

((Popcorn, jQuery) => {

  // function buildScripts(options) {
  //   if (!options.scripts) {
  //     options.scripts = {};
  //
  //     Object.keys(options._natives.manifest.options.scripts).forEach((key) => {
  //       options.scripts[key] = '';
  //     });
  //   } else {
  //     options.scripts._compiled = options.scripts._compiled || {};
  //
  //     Object.keys(options._natives.manifest.options.scripts).forEach((key) => {
  //       /* jslint evil: true */
  //       const fn = new Function('options', options.scripts[key]);
  //       options.scripts._compiled[key] = () => (fn.apply(fn, [{
  //         event: options,
  //       }]));
  //     });
  //   }
  // }

  function timeInRange({ start, end }) {
    const time = this.currentTime();
    return time > start && time < end;
  };

  const fetchAnimation = (url) => fetch(url).then(response => response.json());

  Popcorn.plugin.debug = true;

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
          type: 'input',
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
        zindex: {
          default: 1000,
          hidden: true,
        },
        // scripts: {
        //   onStart: '',
        //   onEnd: '',
        // },
      },
    },

    async _setup(options) {
      let target = Popcorn.dom.find(options.target);
      const container = document.createElement('div');

      const context = this;

      options._container = container;
      options._context = context;

      if (!target) {
        target = this.media.parentNode;
      }

      options._target = target;

      container.classList.add('popcorn-json-animation');

      context.on('trackstart', (event) => {
        if (options.animation) {
          options.animation.play();
        }
      });

      context.on('pause', (event) => {
        if (!options.animation.isPaused && timeInRange.call(this, options)) {
          options.animation.pause();
        }
      });

      context.on('play', (event) => {
        if (options.animation.isPaused && timeInRange.call(this, options)) {
          options.animation.play();
        }
      });

      context.on('seeking', (event) => {
        const time = this.currentTime();
        const { animation, start, end } = options;
        const percentCompleted = (time - start) / (end - start);

        if (timeInRange.call(this, options)) {
          animation.pause();
          animation.goToAndStop(animation.totalFrames * percentCompleted, true);
        }
      });

      context.on('timeupdate', (event) => {

      });

      context.on('ended', (event) => {
        if (options.animation) {
          options.animation.stop();
        }
      });

      context.on('elementSelected', (event) => {
        const { element } = event;

        if (options._container) {
          options._container.classList[element === options ? 'add' : 'remove']('active');
        }
        if (element !== options) {
          draggableResizable(options, { draggable: true, resizable: true });
        }
      });

      options._container.addEventListener('click', (event) => {
        event.stopPropagation();
        context.emit('elementSelected', {
          element: options,
        });
      });

      // buildScripts(options);

      draggableResizable(options, { draggable: true, resizable: true });

      extendObservable(options, {
        url: options.url,
        scale: options.scale,
        start: options.start,
        end: options.end,
        form: getFormFields.call(Popcorn, options.type),
        animData: options.animData,
        colors: options.colors,
      });

      // todo populate default values from manifest
      requestAnimationFrame(() => {
        container.style.position = 'absolute';
        container.style.left = '50%';
        container.style.top = '50%';
        container.style.width = 'auto';
        container.style.height = 'auto';
        container.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.zIndex = +options.zindex || options._natives.manifest.options.zindex.default;

        target.appendChild(container);
      });

      let animData = await fetchAnimation(options.url);
      options.animData = animData;

      if (animData && options && options.colors && options.colors.length) {
        animData = setColors(animData, options.colors);
      }

      options.animation = lottie.loadAnimation({
        container,
        animationData: options.animData,
        loop: false,
        autoplay: false,
      });
    },

    // TODO: showing on canvas
    start(event, options) {
      console.log('JSON started!', event);
      if (!isSafari()) {
        // buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
          options.scripts._compiled.onStart();
        }
      } else {
        setTimeout(() => {
          // buildScripts(options);
          if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
            options.scripts._compiled.onStart();
          }
        }, 430);
      }
    },

    // TODO: update settings in DB (trackEvents)
    _update(trackEvent, options) {
      console.log({ trackEvent, options });
      if (options.colors !== undefined && !isEqual(options.colors, trackEvent.colors)) {
        console.log('updated ', { options });

        trackEvent.colors = options.colors.slice();
        trackEvent.animData = setColors(trackEvent.animData, options.colors);

      }

      if (options.start !== undefined && options.start !== trackEvent.start) {
        trackEvent.start = options.start;
      }

      if (options.end !== undefined && options.end !== trackEvent.end) {
        trackEvent.end = options.end;
      }

      if (options.scale !== undefined && +options.scale !== trackEvent.scale) {
        trackEvent.scale = +options.scale;
      }

      if (options.width !== undefined && options.width !== trackEvent.width) {
        trackEvent.width = options.width;
      }

      if (options.padding !== undefined && options.padding !== trackEvent.padding) {
        trackEvent.padding = options.padding;
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

      draggableResizable(trackEvent, { draggable: true, resizable: true });
    },

    end(event, options) {
      console.log('JSON ended!', event);
      setTimeout(() => {
        // buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
          options.scripts._compiled.onEnd();
        }
      }, 430);
    },

    _teardown(options) {
      if (options._target) {
        options._target.removeChild(options._container);
      }
    },
  });
})(window.Popcorn, window.jQuery);
