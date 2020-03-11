/* eslint-disable space-in-parens,no-underscore-dangle,no-new-func,no-multi-assign,prefer-destructuring,no-var,vars-on-top,no-shadow,camelcase,block-scoped-var,no-use-before-define,no-plusplus,no-undef,max-len,no-unused-expressions */

(function (Popcorn) {
  Popcorn.plugin('pausePlugin', function () {
    const _this = this;


    let _timeout;


    var _seekedFunc = function () {
      if (_timeout) {
        clearTimeout(_timeout);
      }
      this.off('seeked', _seekedFunc);
    };

    return {
      _setup(options) {
        options.toString = function () {
          setTimeout(() => {
            const keyDuration = window.document.querySelectorAll('[data-manifest-key=duration]')[0];
            if (options.duration > 0 && keyDuration) {
              keyDuration.value = options.duration;
            }
          }, 80);
          return `Pause ${options.duration > 0 ? options.duration : 'forever'}`;
        };
      },
      start(event, options) {
        // we need to add this on start as well because we can run into a race condition where 'seeked' is fired before
        // end is fired, or vice versa
        this.on && this.on('seeked', _seekedFunc);
        this.pause && this.pause();
        if (+options.duration > 0) {
          _timeout = setTimeout(() => {
            _this.play();
            _this.off('seeked', _seekedFunc);
          }, options.duration * 1000);
        }

        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
          options.scripts._compiled.onStart();
        }
      },
      end(event, options) {
        // we need to add this on end instead of start because when seeking outside of an active trackevent,
        // end automatically gets fired
        this.on('seeked', _seekedFunc);

        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
          options.scripts._compiled.onEnd();
        }
      },
    };
  },
  {
    displayName: 'Pause',
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
        label: 'Out',
        units: 'seconds',
        hidden: true,
      },
      duration: {
        elem: 'input',
        type: 'number',
        label: 'Pause Duration (0 = forever)',
        units: 'seconds',
        default: '0',
      },
      target: {
        hidden: true,
      },
    },
  });
}(Popcorn));
