/* eslint-disable no-underscore-dangle */
import { TIME, SELECT } from '../../../constants/forms';
import { START, END, LOOP, COUNT, POPCORN_ELEMENT_TYPES } from '../../../constants/popcorn';
import { updateTrackEvent } from '../../../utils/popcorn-helper';
import { emitter, emitterActions } from '../../../mitt/emitter';
import { SANTISECOND } from '../../../constants/project';

const updateFields = [
  START,
  END,
  LOOP,
  COUNT,
];

((Popcorn) => {
  Popcorn.plugin(POPCORN_ELEMENT_TYPES.LOOP, () => ({
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

      if (!options.start) {
        options.start = 0.01;
      }

      if (options.count > 0 || +options.loop === 0) {
        emitter.emit(emitterActions.VIDEO_LOOPED);
        this.play(options.start);
        if (options.loop) {
          options.count -= 1;
        }
      } else {
        options.count = +options.loop;
        this.play(this.currentTime()
          + 1 / SANTISECOND / SANTISECOND); // move to the very first moment out of loop
      }

      if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
        options.scripts._compiled.onEnd();
      }
    },
    _update(trackEvent, options) {
      options = {
        ...options,
        count: options.loop,
      };

      trackEvent = updateTrackEvent(updateFields, trackEvent, options);
    },
  }),
  {
    displayName: 'loop',
    options: {
      [START]: {
        elem: 'input',
        type: TIME,
        label: 'Start',
        units: 'seconds',
        default: 0,
        className: 'input-loop-start',
      },
      [END]: {
        elem: 'input',
        type: TIME,
        label: 'End',
        units: 'seconds',
        default: 0,
        className: 'input-loop-end',
      },
      target: {
        hidden: true,
      },
      [LOOP]: {
        label: 'Number of loops (0 = forever)',
        elem: 'input',
        type: SELECT,
        default: 0,
        items: new Array(11).fill().map((e, i) => ({ value: i, label: i })),
        className: 'select-loop',
      },
    },
  });
})(window.Popcorn);
