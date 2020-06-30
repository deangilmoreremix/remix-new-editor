/* eslint-disable no-underscore-dangle */

import { TIME, NUMBER } from '../../../constants/forms';
import { BASIC_GROUP, START, END, LOOP } from '../../../constants/popcorn';
import { updateTrackEvent } from '../../../utils/popcorn-helper';

const updateFields = [
  START,
  END,
  LOOP,
];

((Popcorn) => {
  Popcorn.plugin('loopPlugin', () => ({
    _setup(options) {
      options.loop = options.loop || 0;
      options.count = +options.loop;
      options.toString = () => `Loop: ${options.loop > 0 ? options.count : 'forever'}`;
    },
    start(event, options) {
      if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
        options.scripts._compiled.onStart();
      }
    },
    end(event, options) {
      if ((this.currentTime() > options.end + 1 || this.currentTime() < options.end - 1)
            || this.seeking()
            || (this.paused() && !this.ended())) {
        options.count = +options.loop;
        return;
      }
      if (options.count > 0 || +options.loop === 0) {
        this.play(options.start);
        if (options.loop) {
          options.count -= 1;
        }
      } else {
        options.count = +options.loop;
        this.play(this.currentTime() + 1);
      }

      if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
        options.scripts._compiled.onEnd();
      }
    },
    _update(trackEvent, options) {
      trackEvent = updateTrackEvent(updateFields, trackEvent, options);
    },
  }),
  {
    displayName: 'loop',
    options: {
      start: {
        elem: 'input',
        type: TIME,
        label: 'Start',
        units: 'seconds',
        group: BASIC_GROUP,
        default: 0,
        className: 'input-time-start',
      },
      end: {
        elem: 'input',
        type: TIME,
        label: 'End',
        units: 'seconds',
        group: BASIC_GROUP,
        default: 0,
        className: 'input-time-end',
      },
      target: {
        hidden: true,
      },
      loop: {
        label: 'Number of loops (0 = forever)',
        elem: 'input',
        type: NUMBER,
        default: 0,
      },
    },
  });
})(window.Popcorn);
