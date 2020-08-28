import React, { useCallback } from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';
import {
  END,
  POPCORN_ELEMENT_TYPES,
  START,
} from '../../lib/constants/popcorn';
import useProjectStore from '../hooks/useProjectStore';
import {
  MAX_DURATION,
  SANTISECOND,
  START_END_DIFFERENCE,
  DEFAULT_DIFFERENCE,
  PAUSE_DIFFERENCE,
} from '../../lib/constants/project';

import TimeInput from './TimeInput';

const ValidationTimeInput = observer(({
  name,
  label,
  onChange,
  disabled,
  inputClassName,
  labelClassName,
  className,
  placeholder,
  value,
  element,
}) => {
  const { duration, updateVideoDuration, updateStartEnd } = useProjectStore();

  /* eslint max-len: ["error", { "ignoreComments": true }] */
  // Description:
  // Video, audio files:
  // 1. Change start - change end (to save the duration) and check.
  //    1.1 If the new end is longer than the length of the video clip, the length of the video clip will increase.
  //    1.2 If the new end is greater than the maximum length of the video, then the new end will be equal to the maximum length of the video, and
  //    the beginning will be as follows: new end - 2s.
  // 2. Change end - start do not changes and check.
  //    2.1 If the new end is longer than the length of the video clip, the length of the video clip will increase.
  //    2.2 If the new end is greater than the maximum length of the video, then the new end will be equal to the maximum length of the video.
  //    2.3 When changing the end, a check is made for the maximum possible duration of the video file. For example, the duration of a video file is 20 seconds, the beginning is 2 seconds, and the end is 10 seconds. This means that the maximum, we can specify the end for it - 2 s + 20 = 22 s.
  //    2.4 If the end is less than the start, then we set a new value for the end, and a new value for the start, taking into account the duration of the video file.
  // Pause:
  // 1. We change only start. If you apply the beginning via input - duration is persists.
  // 2. If the new end of the pause is longer than the duration of the video clip, the duration of the video clip will increase.
  // 3. If the new end is greater than the maximum length of the video, then the new end will be equal to the maximum length of the video, and
  //    the beginning will be as follows: a new end - 5 sec.
  // Other file types:
  // 1. We change the beginning - don't touch the end and do a check.
  //    1.1 If the beginning is greater than the end, then the new end will be equal to: new beginning + 1s.
  //    1.2 If the new end is longer than the length of the video clip, the length of the video clip will increase.
  //    1.3 If the new end is greater than the maximum length of the video, then the new end will be equal to the maximum length of the video, and
  //    the beginning will be as follows: new end - 2s.
  //    1.4 If a new start = end, then the element will change its end, taking into account the duration, that is:
  //    newEnd = (oldEnd - oldStart) + newStart.
  // 2. Change end - do not touch start and do a check.
  //    2.1 If end is equal to start, then new start = newEnd - (oldEnd - oldStart). That is, we keep the duration.
  //    If the new start value is less than 0, then it will be equal to 0.
  //    2.2 If the end is less than the start, we change the beginning and the new value for the start will be: newEnd - 1s. If the new start is less than 0, then it will be equal to 0.

  const onEdit = useCallback(async (newValue) => {
    if (value !== newValue) {
      const { type, start, end } = element;
      const currentDuration = duration / SANTISECOND;
      const maxDuration = MAX_DURATION / SANTISECOND;
      const isStart = label.toLowerCase() === START;
      const isEnd = label.toLowerCase() === END;
      switch (type) {
        case POPCORN_ELEMENT_TYPES.PAUSE: {
          const newPauseEnd = newValue + (end - start);
          if (newPauseEnd > currentDuration && newPauseEnd < maxDuration) {
            await updateVideoDuration(newPauseEnd);
            updateStartEnd(element.id, newValue, newPauseEnd);
          } else if (newPauseEnd > maxDuration) {
            await updateVideoDuration(maxDuration);
            updateStartEnd(
              element.id,
              maxDuration - PAUSE_DIFFERENCE,
              maxDuration,
            );
          } else {
            updateStartEnd(element.id, newValue, newPauseEnd);
          }
          break;
        }
        case POPCORN_ELEMENT_TYPES.SEQUENCER: {
          if (isStart) {
            const elementDuration = end - start;
            const newEnd = +(newValue + elementDuration).toFixed(2);

            if (newEnd < currentDuration) {
              updateStartEnd(element.id, newValue, newEnd);
            } else if (newEnd > currentDuration && newEnd < maxDuration) {
              await updateVideoDuration(newEnd);
              updateStartEnd(element.id, newValue, newEnd);
            } else {
              await updateVideoDuration(maxDuration);
              const maximumStart = newValue <= maxDuration
                - START_END_DIFFERENCE
                ? newValue : maxDuration - START_END_DIFFERENCE;
              updateStartEnd(element.id, maximumStart, maxDuration);
            }
          }
          if (isEnd) {
            if (newValue > start) {
              if (newValue > maxDuration) {
                await updateVideoDuration(maxDuration);
                onChange(maxDuration);
              } else if (newValue > (start + element.duration)) {
                onChange(start + element.duration);
                if ((start + element.duration) > currentDuration) {
                  await updateVideoDuration(start + element.duration);
                }
              } else {
                onChange(newValue);
              }
            } else {
              let newStart = start - (end - newValue);
              if (newStart < 0) {
                newStart = 0;
              }
              updateStartEnd(element.id, newStart, newValue);
            }
          }
          break;
        }
        default: {
          if (newValue > currentDuration) {
            updateVideoDuration(newValue);
          }
          if (isStart) {
            if (newValue === end) {
              updateStartEnd(element.id, newValue, (end - start + newValue));
            } else if (newValue > end) {
              const newEnd = newValue + DEFAULT_DIFFERENCE;
              if (newEnd > currentDuration) {
                if (newEnd > maxDuration) {
                  await updateVideoDuration(maxDuration);
                  updateStartEnd(
                    element.id,
                    maxDuration - DEFAULT_DIFFERENCE,
                    maxDuration,
                  );
                } else {
                  await updateVideoDuration(newEnd);
                  updateStartEnd(element.id, newValue, newEnd);
                }
              } else {
                updateStartEnd(element.id, newValue, newEnd);
              }
            } else {
              onChange(newValue);
            }
          }
          if (isEnd) {
            if (newValue === start) {
              let newStart = newValue - (end - start);
              if (newStart < 0) {
                newStart = 0;
              }
              updateStartEnd(element.id, newStart, newValue);
            } else if (newValue < start) {
              const newStart = newValue - DEFAULT_DIFFERENCE;
              if (newStart < 0) {
                updateStartEnd(element.id, 0, newValue);
              } else {
                updateStartEnd(element.id, newStart, newValue);
              }
            } else {
              onChange(newValue);
            }
          }
        }
      }
    }
  }, [element]);

  return (
    <TimeInput
      name={name}
      value={value}
      className={className}
      onChange={onEdit}
      labelClassName={labelClassName}
      label={label}
      inputClassName={inputClassName}
      disabled={disabled}
      placeholder={placeholder}
      min={0}
      max={MAX_DURATION}
    />
  );
});

ValidationTimeInput.propTypes = {
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.shape(),
  ]),
  element: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.shape(),
  ]).isRequired,
};

ValidationTimeInput.defaultProps = {
  label: '',
  disabled: false,
  onChange: () => {},
};

export default ValidationTimeInput;
