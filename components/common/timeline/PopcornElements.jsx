import React from 'react';
import { observer } from 'mobx-react';
import Grid from '@material-ui/core/Grid';

import ResponsiveGrid from '../../form/grids/ResponsiveGrid';

import { SANTISECOND } from '../../../lib/constants/project';

import PropTypes from '../../../lib/PropTypes';

import useUI from '../../hooks/useUIStore';
import useProjectStore from '../../hooks/useProjectStore';

import { ANIMATION_TYPES } from '../../../lib/constants/animations';


const PopcornElements = observer(({ width }) => {
  const projectStore = useProjectStore();
  const uiStore = useUI();

  const { setAnimationType } = uiStore;

  const { duration: cols, setLayer, updateStartEnd, elements, layers, editElement } = projectStore;

  const layersCount = React.useMemo(() => layers.length, [layers.length]);

  if (!layersCount) {
    return null;
  }

  const backgroundGrid = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < layersCount; i++) {
      arr.push(i);
    }
    return arr.map((value) => <div className="element-row" key={`background-${value}`} />);
  }, [layersCount]);

  const layouts = React.useMemo(() => {
    const result = [];
    elements.forEach(element => {
      const { popcornOptions: { id: i, start, end, animation }, type } = element;
      const layer = layers.find(item => item.id === element.track);
      const x = start * SANTISECOND;
      const w = (end - start) * SANTISECOND;
      result.push({
        i,
        x,
        w,
        h: 1,
        type,
        minH: 1,
        maxH: 1,
        animation,
        y: layer.order,
        maxW: cols - x,
        minW: SANTISECOND,
      });
    });
    return result;
  }, [cols, elements, layers]);

  const setAnim = (type, id) => {
    editElement(id);
    setAnimationType(type);
  };

  const components = React.useMemo(() => layouts.map((item) => (
    <Grid
      container
      key={item.i}
      data-grid={{
        h: 1,
        minH: 1,
        maxH: 1,
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        minW: SANTISECOND,
        maxW: cols - item.x,
      }}
    >
      <span>{item.type}</span>
      <Grid xs={4} item className={item.animations && item.animation.in ? 'in-animation-element' : ''}>
        <button onClick={() => setAnim(ANIMATION_TYPES.IN, item.i)}>a</button>
      </Grid>
      <Grid xs={4} item className={item.animations && item.animation.idle ? 'idle-animation-element' : ''}>
        <button onClick={() => setAnim(ANIMATION_TYPES.IDLE, item.i)}>b</button>
      </Grid>
      <Grid xs={4} item className={item.animations && item.animation.out ? 'out-animation-element' : ''}>
        <button onClick={() => setAnim(ANIMATION_TYPES.OUT, item.i)}>c</button>
      </Grid>
    </Grid>
  )), [layouts, cols, setAnim]);

  const onDragStop = (element, oldElement, newElement) => {
    if (oldElement.y !== newElement.y) {
      setLayer(oldElement.i, newElement.y);
    }
    if (oldElement.x !== newElement.x) {
      const start = newElement.x / SANTISECOND;
      updateStartEnd(oldElement.i, start, start + newElement.w / SANTISECOND);
    }
  };
  const onResizeStop = (element, oldElement, newElement) => {
    if (oldElement.x !== newElement.x || oldElement.w !== newElement.w) {
      const start = newElement.x / SANTISECOND;
      updateStartEnd(oldElement.i, start, start + newElement.w / SANTISECOND);
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
