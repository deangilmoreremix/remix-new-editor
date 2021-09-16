/* eslint-disable space-in-parens,no-underscore-dangle,no-new-func,no-multi-assign,prefer-destructuring,no-var,vars-on-top,no-shadow,camelcase,block-scoped-var,no-use-before-define,no-plusplus,no-undef,max-len,no-throw-literal,no-unused-vars,global-require,import/no-dynamic-require */
import { INPUT, TIME } from "../../../constants/forms";
const SKIP_START = "Start";
const SKIP_END = "End";

(function (Popcorn) {
  Popcorn.plugin(
    "skip",
    () => ({
      _setup(options) {
        var skipTime = options.end;

        options.skipRange = function () {
          var ct = this.currentTime();
          if (!this.paused() && ct > options.start && ct < options.end) {
            this.currentTime(skipTime);
            this.play();
          }
        };
        options.toString = function () {
          return "Skip";
        };

        this.on("timeupdate", options.skipRange);
      },
      start(event, options) {
        if (
          options.scripts &&
          options.scripts._compiled &&
          options.scripts._compiled.onStart
        ) {
          options.scripts._compiled.onStart();
        }
      },
      end(event, options) {
        if (
          options.scripts &&
          options.scripts._compiled &&
          options.scripts._compiled.onEnd
        ) {
          options.scripts._compiled.onEnd();
        }
      },
      _teardown(options) {
        this.off("timeupdate", options.skipRange);
      },
    }),
    {
      options: {
        start: {
          elem: INPUT,
          type: TIME,
          label: SKIP_START,
          default: 0,
          className: "input-skip-start",
        },
        end: {
          elem: INPUT,
          type: TIME,
          label: SKIP_END,
          className: "input-skip-end",
        },
        target: {
          hidden: true,
        },
      },
    }
  );
})(Popcorn);
