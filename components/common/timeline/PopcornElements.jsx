import React from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PopcornElement from './PopcornElement';
import ResponsiveGrid from '../../form/grids/ResponsiveGrid';
import { TRANSITION_TIMELINE_OFFSET } from '../../../lib/constants/settings/video-transition';

import PropTypes from '../../../lib/PropTypes';
import { selectItem } from '../../../lib/mitt/emitter';

import useProjectStore from '../../hooks/useProjectStore';

import { SANTISECOND } from '../../../lib/constants/project';
import { MIN_DURATION, POPCORN_ELEMENT_TYPES, SEQUENCER } from '../../../lib/constants/popcorn';
import { NONE_CLASS } from '../../../lib/constants/animations';
import { DEFAULT_SETTINGS } from '../../../lib/constants/settings';

import { getTransitionButtons } from '../../../lib/utils/timeline';
import TransitionButton from './TransitionButton';

const PopcornElements = observer(({ width }) => {
  const projectStore = useProjectStore();

  const {
    duration: cols,
    updateElementFromTimeline,
    elements,
    layers,
    addElement,
    updateVideoDuration,
    projectData,
  } = projectStore;

  const layersCount = React.useMemo(() => layers.length, [layers.length]);

  if (!layersCount) {
    return null;
  }

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
            if ((element.end - transitionDuration) <= trackEvent.popcornOptions.start) {
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

  const backgroundGrid = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < layersCount; i++) {
      arr.push(i);
    }
    return arr.map((value) => <div className="element-row" key={`background-${value}`} />);
  }, [layersCount]);

  const layouts = React.useMemo(() => elements.map(element => {
    const {
      popcornOptions,
      popcornOptions: { id: i, start, end, animation, title, outDuration, duration },
      type,
      dimensions,
    } = element;

    const layer = layers.find(item => item.id === element.track);
    const x = start * SANTISECOND;
    const w = (getEnd(end, animation, outDuration) - start) * SANTISECOND;

    let maxW = cols - x;

    if (type === SEQUENCER) {
      maxW = duration * SANTISECOND;
    }

    return {
      ...popcornOptions,
      i,
      x,
      w,
      h: 1,
      type,
      minH: 1,
      maxH: 1,
      animation,
      title,
      y: layer.order,
      maxW,
      minW: (MIN_DURATION + getExtraDuration(animation, outDuration)) * SANTISECOND,
      layer,
      dimensions,
      isResizable: type !== POPCORN_ELEMENT_TYPES.JSON_TRANSITION,
    };
  }), [cols, elements, getEnd, getExtraDuration, layers]);

  const components = React.useMemo(() => layouts.map((item, index, items) => {
    const transitionButtons = getTransitionButtons(item, index, items);

    return (
      <div
        className={classnames('timeline-grid-item', item.type)}
        key={item.i}
        data-grid={{
          h: 1,
          minH: 1,
          maxH: 1,
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          minW: item.minW,
          maxW: item.maxW,
        }}
      >
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
      </div>
    );
  }), [layouts]);

  const onDragStop = (element, oldElement, newElement) => {
    selectItem({ type: 'click' }, newElement.i);
    const needUpdateLayer = oldElement.y !== newElement.y;
    const needUpdateStartEnd = oldElement.x !== newElement.x;
    let start;
    let end;
    if (needUpdateStartEnd) {
      start = newElement.x / SANTISECOND;
      end = start + (newElement.w - newElement.minW) / SANTISECOND + MIN_DURATION;
    }
    if (needUpdateStartEnd || needUpdateLayer) {
      updateElementFromTimeline({
        end,
        start,
        needUpdateLayer,
        needUpdateStartEnd,
        elementId: oldElement.i,
        layerLevel: newElement.y,
      });
    }
  };

  const onResizeStop = (element, oldElement, newElement) => {
    if (oldElement.x !== newElement.x || oldElement.w !== newElement.w) {
      const start = newElement.x / SANTISECOND;
      const end = start + (newElement.w - newElement.minW) / SANTISECOND + MIN_DURATION;
      updateElementFromTimeline({ needUpdateStartEnd: true, elementId: oldElement.i, start, end });
    }
  };

  return (
    <div className="elements">
      <ResponsiveGrid
        cols={cols}
        width={width}
        marginTop={1}
        marginLeft={1}
        rowHeight={34}
        preventCollision
        layouts={layouts}
        className="layout"
        maxRows={layersCount}
        components={components}
        onDragStop={onDragStop}
        onResizeStop={onResizeStop}
      />
      <div className="elements-grid">
        {backgroundGrid}
      </div>
    </div>
  );
},
);

PopcornElements.propTypes = {
  width: PropTypes.number.isRequired,
};

export default PopcornElements;
