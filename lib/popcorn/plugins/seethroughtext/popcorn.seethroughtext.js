/* eslint-disable space-in-parens,no-underscore-dangle,no-new-func,no-multi-assign,prefer-destructuring,no-var,vars-on-top,no-shadow,camelcase,block-scoped-var,no-use-before-define,no-plusplus,no-undef,max-len,prefer-const,no-unused-vars */

(function (Popcorn) {
  const DEFAULT_BACKGROUND = '#000000';


  const DEFAULT_FONT_SIZE = 10;


  const DEFAULT_FONT_COLOR = '#000000';


  const DEFAULT_SHADOW_COLOR = '#444444';


  const DEFAULT_FONT = 'Bowlby One SC';

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
        options.scripts._compiled[key] = function () {
          return fn.apply(fn, [{
            event: options,
          }]);
        };
      });
    }
  }

  function createText(canvas, options) {
    const ctx = canvas.getContext('2d', { antialias: true });
    const v = document.getElementById('video-container');
    const vH = v.offsetHeight;
    const vW = v.offsetWidth;
    const text = options.text;
    let bgcolor = DEFAULT_BACKGROUND;
    const fontFamily = options.fontFamily;

    const fontDecorations = options.fontDecorations;
    let trans = options.backgroundTransparent;

    if (options.background) {
      bgcolor = options.backgroundColor;
    }

    if (trans <= 0) {
      trans = 0;
    } else if (trans >= 100) {
      trans = 100;
    }
    const hex = bgcolor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    bgcolor = `rgba(${r},${g},${b},${trans / 100})`;
    ctx.canvas.width = vW;
    ctx.canvas.height = vH;
    ctx.save();
    ctx.globalCompositeOperation = 'xor';
    ctx.beginPath();
    let textDimensions;
    let fontsizes = 20;
    do {
      ctx.font = `${fontDecorations} ${fontsizes--}em ${fontFamily}`;
      textDimensions = ctx.measureText(text);
    } while ((textDimensions.width >= ctx.canvas.width) && (text.length > 0));
    const tempcanvaswidth = (ctx.canvas.width - textDimensions.width) / 2;
    let heightAdjust = 0.75;
    if (fontFamily === 'Fjalla One' || fontFamily === 'Oswald') {
      heightAdjust += 0.05;
    }
    if ((fontFamily === 'Bowlby One SC') && (text.length > 3)) {
      heightAdjust -= 0.10;
    }
    if (text.length <= 3) {
      heightAdjust += 0.10;
    }
    if (text.length === 4) {
      heightAdjust += 0.05;
    }
    const txtHeight = (ctx.canvas.height * heightAdjust);
    ctx.fillText(text, tempcanvaswidth, txtHeight);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = bgcolor;
    ctx.rect(0, 0, vW, vH);
    ctx.fill();
    ctx.restore();
  }

  Popcorn.plugin('seethroughtext', {
    manifest: {
      about: {
        name: 'Popcorn Maker See-through text Plugin',
        varsion: '0.1',
        author: 'Arnel Celedonio @digistrats',
        website: 'http://digistrats.com',
      },
      options: {
        text: {
          elem: 'textarea',
          label: 'Text',
          default: 'VIDEO',
        },
        linkUrl: {
          elem: 'input',
          type: 'text',
          label: 'Link URL',
          hidden: true,
        },
        linkTarget: {
          elem: 'select',
          options: ['New Tab', 'Current Tab'],
          values: ['_blank', '_parent'],
          label: 'Open Link In',
          default: '_blank',
          hidden: true,
        },
        position: {
          elem: 'select',
          options: ['Custom', 'Middle', 'Bottom', 'Top'],
          values: ['custom', 'middle', 'bottom', 'top'],
          label: 'Text Position',
          default: 'custom',
          hidden: true,
        },
        alignment: {
          elem: 'select',
          options: ['Center', 'Left', 'Right'],
          values: ['center', 'left', 'right'],
          label: 'Text Alignment',
          default: 'left',
          hidden: true,
        },
        start: {
          elem: 'input',
          type: 'text',
          label: 'In',
          group: 'advanced',
          units: 'seconds',
        },
        end: {
          elem: 'input',
          type: 'text',
          label: 'Out',
          group: 'advanced',
          units: 'seconds',
        },
        transition: {
          elem: 'select',
          options: ['None', 'Pop', 'Fade', 'Slide Up', 'Slide Down', 'Fade In Up'],
          values: ['popcorn-none', 'popcorn-pop', 'popcorn-fade', 'popcorn-slide-up', 'popcorn-slide-down', 'popcorn-fade-in-up'],
          label: 'Transition',
          default: 'popcorn-fade',
          hidden: true,
        },
        fontFamily: {
          elem: 'select',
          label: 'Font',
          styleClass: '',
          googleFonts: true,
          group: 'advanced',
          default: DEFAULT_FONT,
        },
        fontColor: {
          elem: 'input',
          type: 'color',
          label: 'Font color',
          default: DEFAULT_FONT_COLOR,
          group: 'advanced',
          hidden: true,
        },
        shadow: {
          elem: 'input',
          type: 'checkbox',
          label: 'Shadow',
          default: false,
          group: 'advanced',
          hidden: true,
        },
        shadowColor: {
          elem: 'input',
          type: 'color',
          label: 'Shadow colour',
          default: DEFAULT_SHADOW_COLOR,
          group: 'advanced',
          hidden: true,
        },
        background: {
          elem: 'input',
          type: 'checkbox',
          label: 'Background',
          default: false,
          group: 'advanced',
        },
        backgroundColor: {
          elem: 'input',
          type: 'color',
          label: 'Background color',
          default: DEFAULT_BACKGROUND,
          group: 'advanced',
        },
        backgroundTransparent: {
          elem: 'input',
          type: 'number',
          label: 'Background (Transparency)',
          default: 100,
        },
        fontDecorations: {
          elem: 'checkbox-group',
          labels: { bold: 'Bold' },
          default: { bold: false },
          group: 'advanced',
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
        zindex: {
          hidden: true,
        },
        scripts: {
          onStart: '',
          onEnd: '',
        },
      }, // options
    }, // manifest
    _setup(options) {
      let target = options.target;


      const container = document.createElement('div');


      const context = this;


      let fontSheet;


      const fontDecorations = options.fontDecorations || options._natives.manifest.options.fontDecorations.default;
      const innerDivCanvas = document.createElement('canvas');

      innerDivCanvas.style.position = 'absolute';
      innerDivCanvas.style.width = '100%';
      innerDivCanvas.style.top = '0';
      innerDivCanvas.style.left = '0';
      innerDivCanvas.style.height = '100%';
      innerDivCanvas.style.zIndex = '9999';
      target.appendChild(container);
      container.appendChild(innerDivCanvas);
      options._container = container;
      container.classList.add('popcorn-see-through-text');
      container.classList.add('off');

      container.addEventListener('click', () => {
        context.emit('elementSelected', {
          element: options,
        });
      });

      if (!target) {
        target = context.media.parentNode;
      }
      options._target = target;
      fontSheet = document.createElement('link');
      fontSheet.rel = 'stylesheet';
      fontSheet.type = 'text/css';
      fontSheet.href = `https://fonts.googleapis.com/css?family=${options.fontFamily.replace(/\s/g, '+')}`;
      document.head.appendChild(fontSheet);
      options.fontFamily = options.fontFamily ? options.fontFamily : options._natives.manifest.options.fontFamily.default;
      // Store reference to generated sheet for removal later, remove any existing ones
      options._fontSheet = fontSheet;

      options.toString = function () {
        return options.text || options._natives.manifest.options.text.default;
      };
      // options.fontDecorations = fontDecorations.bold ? "bold" : "normal";
      options.fontDecorations = fontDecorations.bold === true ? 'bold' : 'normal';
      options.fontSize = options.fontSize ? options.fontSize : DEFAULT_FONT_SIZE;

      fontSheet.onload = function () {
        // Apply all the styles
        container.style.fontFamily = options.fontFamily ? options.fontFamily : DEFAULT_FONT;
        setTimeout(() => {
          createText(innerDivCanvas, options);
        }, 800);
      };
      options._container.style.display = 'none';
      buildScripts(options);
    },
    start(event, options) {
      const container = options._container;


      let redrawBug;

      if (container) {
        container.classList.add('on');
        container.classList.remove('off');

        // Safari Redraw hack - #3066
        container.style.display = 'none';
        redrawBug = container.offsetHeight;
        container.style.display = '';
      }
      options._container.style.display = 'block';

      buildScripts(options);
      if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
        options.scripts._compiled.onStart();
      }
    },
    end(event, options) {
      // console.log('event',event);
      if (options._container) {
        options._container.style.display = 'none';
      }

      buildScripts(options);
      if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
        options.scripts._compiled.onEnd();
      }
    },
    _teardown(options) {
      if (options._container && options._target) {
        options._target.removeChild(options._container);
      }

      if (options._fontSheet) {
        document.head.removeChild(options._fontSheet);
      }
    },
  });
}(Popcorn));
