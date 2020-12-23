import React, { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react';
import PropTypes from 'prop-types';
import moment from 'moment';
import _ from 'lodash';
import Timeline from 'timeline/lib/index';
import classnames from 'classnames';

import useProjectStore from '../../hooks/useProjectStore';
import { ASSET_TYPES } from '../../../lib/constants/media';
import { FRACTIONAL_NUMBER, SANTISECOND } from '../../../lib/constants/project';
import { MIN_DURATION, POPCORN_ELEMENT_TYPES, SEQUENCER } from '../../../lib/constants/popcorn';
import { NONE_CLASS } from '../../../lib/constants/animations';
import { DEFAULT_SETTINGS } from '../../../lib/constants/settings';
import { getTransitionButtons } from '../../../lib/utils/timeline';
import { LOWER_THIRDS_END_DURATION } from '../../../lib/constants/lowerThirds';
import { selectItem, arrayDeleteListener } from '../../../lib/mitt/emitter';

import PopcornElement from './PopcornElement';
import { TRANSITION_TIMELINE_OFFSET } from '../../../lib/constants/settings/video-transition';
import TransitionButton from './TransitionButton';

const PopcornElements = observer(({
  startDate,
  endDate,
  startDateWithZoom,
  endDateWithZoom,
  sortableWidth,
  layersRef,
}) => {
  const {
    changeDuration,
    layers,
    elements,
    duration: cols,
    projectData,
    updateVideoDuration,
    updateElementFromTimeline,
    addElement,
    releaseElement,
    activeElementId,
    timelineSelectedItems,
    setTimelineSelectedItems,
  } = useProjectStore();

  const layersCount = React.useMemo(() => layers.length, [layers.length]);

  if (!layersCount) {
    return null;
  }

  useEffect(() => {
    if (activeElementId && !timelineSelectedItems.some(item => item === activeElementId)) {
      setTimelineSelectedItems([activeElementId]);
    }
  }, [activeElementId]);

  useEffect(() => arrayDeleteListener(), []);

  const getExtraDuration = React.useCallback((animation, outDuration) => {
    if (animation && animation.out && animation.out.duration && animation.out.type !== NONE_CLASS) {
      return animation.out.duration;
    }
    if (outDuration) {
      return outDuration;
    }
    return 0;
  }, []);

  const getEnd = React.useCallback((end, animation, outDuration) => {
    end += getExtraDuration(animation, outDuration);
    return end;
  }, [getExtraDuration]);

  const insertTransition = async ({ transition, element }) => {
    const transitionDuration = +((transition.end - transition.start).toFixed(2));
    transition.start = +(transition.start.toFixed(2)) + TRANSITION_TIMELINE_OFFSET;
    transition.end = +(transition.end.toFixed(2)) + TRANSITION_TIMELINE_OFFSET;

    const elementsForUpdate = [];
    const elementsEnds = [];
    let animationOut = 0;
    let itemStartAfterToVideo = null;

    const currentLayer = elements.filter(item => item.id === element.id);

    projectData.media.forEach((media) => {
      media.tracks.map((track) => {
        track.trackEvents.forEach(trackEvent => {
          if (trackEvent.track === currentLayer[0].track) {
            elementsEnds.push(trackEvent.popcornOptions.end);
            if ((element.end - transitionDuration) <= trackEvent.popcornOptions.end) {
              elementsForUpdate.push(trackEvent);
              if (trackEvent.popcornOptions.animation && trackEvent.popcornOptions.animation.out) {
                animationOut += trackEvent.popcornOptions.animation.out.duration;
              }
            }
          }
        });
        return null;
      });
    });

    if (elementsForUpdate && elementsForUpdate.length) {
      elementsForUpdate.forEach(item => {
        if (item.popcornOptions.start <= itemStartAfterToVideo || !itemStartAfterToVideo) {
          itemStartAfterToVideo = item.popcornOptions.start;
        }
      });
    }

    if (element.end > itemStartAfterToVideo) {
      if (cols < (Math.max(...elementsEnds)
        + transitionDuration + animationOut) * SANTISECOND) {
        await updateVideoDuration((cols / SANTISECOND) + transitionDuration);
      }

      if (elementsForUpdate && elementsForUpdate.length) {
        elementsForUpdate.forEach(item => (
          updateElementFromTimeline({
            needUpdateStartEnd: true,
            elementId: item.id,
            start: item.popcornOptions.start + transitionDuration,
            end: item.popcornOptions.end + transitionDuration,
          })));
      }
    }

    await updateElementFromTimeline({
      needUpdateStartEnd: true,
      elementId: element.id,
      start: transition.end + TRANSITION_TIMELINE_OFFSET,
      end: (element.end - element.start) + transition.end,
    });
    await addElement({
      ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION],
      ...transition,
    });
  };

  const layouts = React.useMemo(() => elements.map(element => {
    const {
      popcornOptions,
      popcornOptions: { id, start, animation, title, outDuration, duration, kind },
      type,
      dimensions,
    } = element;

    let { popcornOptions: { end } } = element;

    if (kind === ASSET_TYPES.PERSONALIZED_VOICE && duration < 1) {
      end = start + (cols / FRACTIONAL_NUMBER > 1 ? cols / FRACTIONAL_NUMBER : 1);
    }

    let maxDuration = null;

    if (type === SEQUENCER) {
      maxDuration = duration * 1000;
    }

    const x = start * SANTISECOND;
    const w = (getEnd(end, animation, outDuration) - start) * SANTISECOND;
    const layer = layers.find(item => item.id === element.track);
    const timeStart = moment(startDate.diff(0) + start * 1000);
    let timeEnd = moment(startDate.diff(0) + end * 1000);

    if (animation?.out?.duration) {
      timeEnd = moment(timeEnd.diff(0) + animation.out.duration * 1000);
    } else if (type === POPCORN_ELEMENT_TYPES.JSON_ANIMATION) {
      timeEnd = moment(timeEnd.diff(0) + LOWER_THIRDS_END_DURATION * 1000);
    }

    return {
      ...popcornOptions,
      x,
      y: layer.order,
      w,
      i: id,
      key: id,
      start: timeStart,
      end: timeEnd,
      type,
      animation,
      color: '#363651',
      title,
      row: layer.order,
      maxDuration,
      layer,
      dimensions,
      minDuration: (MIN_DURATION + getExtraDuration(animation, outDuration)) * 1000,
      isResizable: type !== POPCORN_ELEMENT_TYPES.JSON_TRANSITION
        && kind !== ASSET_TYPES.PERSONALIZED_VOICE
        && type !== POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION,
    };
  }), [cols, elements, getEnd, getExtraDuration, layers]);

  const components = React.useMemo(() => layouts.map((item, index, array) => {
    const transitionButtons = getTransitionButtons(item, index, array);
    item.render = (props) => (
      <span className={classnames('timeline-grid-item', item.type)} {...props}>
        <PopcornElement item={item} />
        {transitionButtons && transitionButtons.length
          ? transitionButtons.map(({ transition, element, type, key, from, to }) => (
            <TransitionButton
              key={key}
              type={type}
              onClick={() => insertTransition({ transition, element })}
              from={from}
              to={to}
            />
          ))
          : null}
      </span>
    );
    return item;
  }), [layouts]);

  const groups = useMemo(() => {
    if (layers.length) {
      return layers.map((item, i) => ({ id: Number(i) }));
    } else {
      return [];
    }
  }, [layers]);

  const changeTimelineDuration = value => {
    changeDuration(value.diff(startDate) / 1000);
  };

  const handleRowClick = () => {
    releaseElement();
    setTimelineSelectedItems([]);
  };

  const handleInteraction = (type, changes, newElements) => {
    switch (type) {
      case Timeline.changeTypes.oneItemSelected: {
        changes.e.stopPropagation();
        const newSelection = timelineSelectedItems.slice();
        const idx = timelineSelectedItems.indexOf(changes.item.id);
        if (changes.e.ctrlKey || changes.e.shiftKey || changes.e.metaKey) {
          if (idx >= 0) {
            if (activeElementId !== changes.item.id) {
              selectItem(changes.e, changes.item.i);
            } else {
              newSelection.splice(idx, 1);
              releaseElement();
            }
          } else {
            newSelection.push(changes.item.key);
            if (Object.values(POPCORN_ELEMENT_TYPES).includes(changes.item.type)) {
              selectItem(changes.e, changes.item.i);
            }
          }
          setTimelineSelectedItems(newSelection);
        } else {
          if (activeElementId !== changes.item.id) {
            selectItem(changes.e, changes.item.i);
            setTimelineSelectedItems([changes.item.id]);
          } else {
            setTimelineSelectedItems();
            releaseElement();
          }
          return null;
        }
        break;
      }
      case Timeline.changeTypes.dragStart:
      case Timeline.changeTypes.resizeStart: {
        return timelineSelectedItems;
      }
      case Timeline.changeTypes.dragEnd:
      case Timeline.changeTypes.resizeEnd: {
        const returnSelectedItems = [];
        newElements.forEach(item => {
          let needUpdateLayer = false;
          let needUpdateStartEnd = false;
          let start;
          let end;

          if (!item.notSelected) {
            returnSelectedItems.push(item.key);
          }

          if (item.isUpdatedRow) {
            needUpdateLayer = true;
          }
          if (item.isUpdatedStartEnd) {
            needUpdateStartEnd = true;
            start = item.start.diff(startDate) / 1000;

            if (item.animation?.out?.duration) {
              end = (item.end.diff(startDate) - item.animation?.out?.duration * 1000) / 1000;
            } else if (item.type === POPCORN_ELEMENT_TYPES.JSON_ANIMATION) {
              end = (item.end.diff(startDate) - LOWER_THIRDS_END_DURATION * 1000) / 1000;
            } else {
              end = item.end.diff(startDate) / 1000;
            }
          }

          if (needUpdateLayer || needUpdateStartEnd) {
            updateElementFromTimeline({
              end,
              start,
              needUpdateLayer,
              needUpdateStartEnd,
              elementId: item.id,
              layerLevel: item.row,
            });
          }
        });
        setTimelineSelectedItems(returnSelectedItems);
        break;
      }
      case Timeline.changeTypes.itemsSelected: {
        setTimelineSelectedItems(_.map(changes, 'key'));
        break;
      }
      default:
        return changes;
    }
  };

  if (startDateWithZoom && endDateWithZoom) {
    return (
      <Timeline
        shallowUpdateCheck
        items={components}
        groups={groups}
        startDate={startDateWithZoom}
        endDate={endDateWithZoom}
        originalStartDate={startDate}
        originalEndDate={endDate}
        selectedItems={timelineSelectedItems}
        showCursorTime
        itemHeight={35}
        scrollBlock={layersRef.current}
        onInteraction={handleInteraction}
        onRowClick={handleRowClick}
        componentId="timeline-block"
        updateEndDate={changeTimelineDuration}
        layersNumber={layersCount}
        offsetLeft={sortableWidth}
        activeElementId={activeElementId}
        // offsetLeft - is necessary in order to make a multi-selection correctly.
        // This value shows us the distance of the timeline to the left edge of the browser window.
      />
    );
  }
  return null;
});

PopcornElements.propTypes = {
  startDate: PropTypes.shape({}).isRequired,
  endDate: PropTypes.shape({}).isRequired,
  startDateWithZoom: PropTypes.shape({}).isRequired,
  endDateWithZoom: PropTypes.shape({}).isRequired,
  sortableWidth: PropTypes.number.isRequired,
};

export default PopcornElements;
