import React from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PopcornElement from './PopcornElement';
import ResponsiveGrid from '../../form/grids/ResponsiveGrid';

import PropTypes from '../../../lib/PropTypes';

import useProjectStore from '../../hooks/useProjectStore';

import { SANTISECOND } from '../../../lib/constants/project';
import { MIN_DURATION, POPCORN_ELEMENT_TYPES } from '../../../lib/constants/popcorn';
import { NONE_CLASS } from '../../../lib/constants/animations';
import { DEFAULT_SETTINGS } from '../../../lib/constants/settings';

import { getTransitionButtons } from '../../../lib/utils/timeline';
import TransitionButton from './TransitionButton';


const PopcornElements = observer(({ width }) => {
  const projectStore = useProjectStore();

  const {
    duration: cols,
    setLayer,
    updateStartEnd,
    elements,
    layers,
    addElement,
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
    await updateStartEnd(element.id, element.start, element.end);
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
      popcornOptions: { id: i, start, end, animation, title, outDuration },
      type,
    } = element;
    const layer = layers.find(item => item.id === element.track);
    const x = start * SANTISECOND;
    const w = (getEnd(end, animation, outDuration) - start) * SANTISECOND;
    return {
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
      maxW: cols - x,
      minW: (MIN_DURATION + getExtraDuration(animation, outDuration)) * SANTISECOND,
      layer,
    };
  }), [cols, elements, layers]);

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
          maxW: cols - item.x,
        }}
      >
        <PopcornElement
          item={item}
        />
        {transitionButtons && transitionButtons.length
          ? transitionButtons.map(({
            transition,
            element,
            type,
            key,
            pair,
          }) => (
            <TransitionButton
              key={key}
              type={type}
              onClick={() => insertTransition({ transition, element })}
              from={pair.from}
              to={pair.to}
            />
          ))
          : null}
      </div>
    );
  }), [layouts, cols]);

  const onDragStop = (element, oldElement, newElement) => {
    if (oldElement.y !== newElement.y) {
      setLayer(oldElement.i, newElement.y);
    }
    if (oldElement.x !== newElement.x) {
      const start = newElement.x / SANTISECOND;
      const end = start + (newElement.w - newElement.minW) / SANTISECOND + MIN_DURATION;
      updateStartEnd(oldElement.i, start, end);
    }
  };
  const onResizeStop = (element, oldElement, newElement) => {
    if (oldElement.x !== newElement.x || oldElement.w !== newElement.w) {
      const start = newElement.x / SANTISECOND;
      const end = start + (newElement.w - newElement.minW) / SANTISECOND + MIN_DURATION;
      updateStartEnd(oldElement.i, start, end);
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
