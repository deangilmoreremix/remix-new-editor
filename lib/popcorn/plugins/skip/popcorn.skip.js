/* eslint-disable space-in-parens,no-underscore-dangle,no-new-func,no-multi-assign,prefer-destructuring,no-var,vars-on-top,no-shadow,camelcase,block-scoped-var,no-use-before-define,no-plusplus,no-undef,max-len,no-throw-literal,no-unused-vars,global-require,import/no-dynamic-require */


(function ( Popcorn ) {
  Popcorn.plugin( 'skip', () => ({
    _setup( options ) {
      var skipTime = options.end;

      options.skipRange = function () {
        var ct = this.currentTime();
        if ( !this.paused() && ct > options.start && ct < options.end ) {
          this.currentTime( skipTime );
        }
      };
      options.toString = function () {
        return 'Skip';
      };

      this.on( 'timeupdate', options.skipRange );
    },
    start(event, options) {
      if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
        options.scripts._compiled.onStart();
      }
    },
    end(event, options) {
      if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
        options.scripts._compiled.onEnd();
      }
    },
    _teardown( options ) {
      this.off( 'timeupdate', options.skipRange );
    },
  }),
  {
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
      },
      target: {
        hidden: true,
      },
    },
  });
}( Popcorn ));
