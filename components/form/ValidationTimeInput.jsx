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
  const {
    duration,
    updateVideoDuration,
    updateStartEnd,
    projectData,
    updateLayerElements,
  } = useProjectStore();

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

  const updateNewEnd = useCallback((newEnd) => {
    if (newEnd < element.popcornOptions.end) {
      return newEnd;
    }
    const differenceLength = newEnd - element.popcornOptions.end;
    const elementsEnds = [];
    let animationOut = 0;
    const maxDuration = MAX_DURATION / SANTISECOND;

    projectData.media.forEach((media) => {
      media.tracks.map((track) => {
        track.trackEvents.forEach(trackEvent => {
          if (trackEvent.track === element.track) {
            elementsEnds.push(trackEvent.popcornOptions.end);
            if (element.popcornOptions.end <= trackEvent.popcornOptions.start) {
              if (trackEvent.popcornOptions.animation
                && trackEvent.popcornOptions.animation.out) {
                // eslint-disable-next-line max-len
                animationOut += trackEvent.popcornOptions.animation.out.duration;
              }
            }
          }
        });
        return null;
      });
    });

    const lastEnd = Math.max(...elementsEnds) + differenceLength + animationOut;
    if (lastEnd > maxDuration && !elementsEnds) {
      const difference = lastEnd - maxDuration;
      return newEnd - difference;
    } else if (lastEnd > maxDuration && elementsEnds && elementsEnds.length) {
      return maxDuration;
    } else {
      return newEnd;
    }
  }, [element]);

  const newLastEndOnLayer = useCallback((newEnd) => {
    const differenceLength = newEnd - element.popcornOptions.end;
    const elementsEnds = [];
    let animationOut = 0;

    projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents.forEach(trackEvent => {
          if (trackEvent.track === element.track) {
            elementsEnds.push(trackEvent.popcornOptions.end);
            if (element.popcornOptions.end <= trackEvent.popcornOptions.start) {
              if (trackEvent.popcornOptions.animation
                && trackEvent.popcornOptions.animation.out) {
                // eslint-disable-next-line max-len
                animationOut += trackEvent.popcornOptions.animation.out.duration;
              }
            }
          }
        });
      });
    });

    const lastNewEnd = Math.max(...elementsEnds)
      + differenceLength + animationOut;

    if (differenceLength > 0) {
      return lastNewEnd;
    }

    return 0;
  }, [element]);

  const updateNewStart = useCallback((newStart) => {
    // const differenceLength = newEnd - element.popcornOptions.end;
    const elementsEnds = [];
    let animationOut = 0;

    projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents.forEach(trackEvent => {
          if (trackEvent.track === element.track) {
            // eslint-disable-next-line max-len
            if (element.popcornOptions.start >= trackEvent.popcornOptions.end) {
              elementsEnds.push(trackEvent.popcornOptions.end);
              if (trackEvent.popcornOptions.animation
                && trackEvent.popcornOptions.animation.out) {
                // eslint-disable-next-line max-len
                animationOut += trackEvent.popcornOptions.animation.out.duration;
              }
            }
          }
        });
      });
    });

    const minStartForElement = Math.max(...elementsEnds) + animationOut;

    if (newStart < minStartForElement) {
      return minStartForElement + 0.01;
    } else {
      return newStart;
    }
  }, [element]);

  const onEdit = useCallback(async (newValue) => {
    if (value !== newValue) {
      const { type, popcornOptions: { start, end } } = element;
      const currentDuration = duration / SANTISECOND;
      const maxDuration = MAX_DURATION / SANTISECOND;
      const isStart = label.toLowerCase() === START;
      const isEnd = label.toLowerCase() === END;

      switch (type) {
        case POPCORN_ELEMENT_TYPES.PAUSE: {
          const newPauseEnd = newValue + (end - start);

          updateLayerElements(newPauseEnd, element);
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
            if (newValue < start) {
              if (newValue !== updateNewStart(newValue)) {
                newValue = updateNewStart(newValue);
              }
            }
            let newEnd = +(newValue + elementDuration).toFixed(2);
            newEnd = updateNewEnd(newEnd);

            updateLayerElements(newEnd, element);

            if (newLastEndOnLayer(newEnd) < currentDuration) {
              updateStartEnd(element.id, newValue, newEnd);
            } else if (newLastEndOnLayer(newEnd) > currentDuration
              && newLastEndOnLayer(newEnd) < maxDuration) {
              await updateVideoDuration(newEnd);
              updateStartEnd(element.id, newValue, newEnd);
            } else {
              await updateVideoDuration(maxDuration);
              const maximumStart = newValue <= maxDuration
                - START_END_DIFFERENCE
                ? newValue : newEnd - START_END_DIFFERENCE;
              updateStartEnd(element.id, maximumStart, newEnd);
            }
          }
          if (isEnd) {
            if (newValue > start) {
              if (newLastEndOnLayer(newValue) > maxDuration) {
                await updateVideoDuration(maxDuration);
                updateLayerElements(updateNewEnd(newValue), element);
                onChange(updateNewEnd(newValue));
              } else if (newValue > (start + element.popcornOptions.duration)) {
                const newEnd = start + element.popcornOptions.duration;
                // eslint-disable-next-line max-len
                if ((start + element.popcornOptions.duration) > currentDuration) {
                  await updateVideoDuration(newEnd);
                }
                updateLayerElements(newEnd, element);
                onChange(newEnd);
              } else {
                updateLayerElements(newValue, element);
                onChange(newValue);
              }
            } else {
              const elementDuration = end - start;
              let newStart = start - (end - newValue);
              if (newStart < 0) {
                newStart = 0;
              }
              if (newValue < 1) {
                newValue = 1;
              }

              if (newStart !== updateNewStart(newStart)) {
                newStart = updateNewStart(newStart);
                newValue = +(newStart + elementDuration).toFixed(2);
              }

              updateStartEnd(element.id, newStart, newValue);
            }
          }
          break;
        }
        default: {
          if (newValue > currentDuration && newValue < maxDuration) {
            await updateVideoDuration(newValue);
          }

          if (isStart) {
            if (newValue === end) {
              let newEnd = end - start + newValue;
              if (newEnd !== updateNewEnd(newEnd)) {
                newEnd = updateNewEnd(newEnd);
                newValue = newEnd - 1;
              }
              updateLayerElements(newEnd, element);
              updateStartEnd(element.id, newValue, newEnd);
            } else if (newValue > end) {
              let newEnd = newValue + DEFAULT_DIFFERENCE;
              if (newEnd > currentDuration) {
                if (newLastEndOnLayer(newEnd) > maxDuration) {
                  await updateVideoDuration(maxDuration);
                  newEnd = updateNewEnd(newEnd);
                  updateLayerElements(newEnd, element);
                  updateStartEnd(
                    element.id,
                    maxDuration - DEFAULT_DIFFERENCE,
                    newEnd,
                  );
                } else {
                  await updateVideoDuration(newEnd);
                  updateLayerElements(newEnd, element);
                  updateStartEnd(element.id, newValue, newEnd);
                }
              } else {
                updateLayerElements(newEnd, element);
                updateStartEnd(element.id, newValue, newEnd);
              }
            } else {
              if (newValue !== updateNewStart(newValue)) {
                newValue = updateNewStart(newValue);
              }
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
              let newStart = newValue - DEFAULT_DIFFERENCE;
              if (newStart < 0) {
                newStart = 0;
              }
              if (newValue === 0) {
                newValue = DEFAULT_DIFFERENCE;
              }
              if (newStart !== updateNewStart(newStart)) {
                newStart = updateNewStart(newStart);
                newValue = newStart + DEFAULT_DIFFERENCE;
              }

              updateStartEnd(element.id, newStart, newValue);
            } else {
              newValue = updateNewEnd(newValue);
              updateLayerElements(newValue, element);
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
  element: PropTypes.shape({
    id: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    popcornOptions: PropTypes.shape().isRequired,
    track: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]).isRequired,
  }).isRequired,
};

ValidationTimeInput.defaultProps = {
  label: '',
  disabled: false,
  onChange: () => {},
};

export default ValidationTimeInput;
