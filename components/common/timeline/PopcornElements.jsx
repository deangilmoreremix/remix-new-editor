import React from 'react';
import { observer } from 'mobx-react';
import _ from 'lodash';

import useProjectStore from '../../hooks/useProjectStore';
import ResponsiveGrid from '../../form/grids/ResponsiveGrid';

const ms = 100;

const generateElements = (cols, layers, elements) => {
  const result = [];
  elements.forEach(element => {
    const { popcornOptions: { id: i, start, end }, type } = element;
    const layer = layers.find(item => item.id === element.track);
    const x = start * ms;
    const w = (end - start) * ms;
    result.push({
      i,
      x,
      w,
      h: 1,
      y: layer.order,
      type,
      minH: 1,
      maxH: 1,
      minW: ms,
      maxW: cols - x,
    });
  });
  // });
  return result;
};

const PopcornElements = observer(({width}) => {
  const projectStore = useProjectStore();
  // todo for empty project
  // todo get width
  const { duration: cols, setLayer, updateStartEnd, popcorn, elements, layers } = projectStore;

  const layersCount = React.useMemo(() => _.size(layers), [layers]);

  const backgroundGrid = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < layersCount; i++) {
      arr.push(i);
    }
    return arr.map((value) => <div className="element-row" key={`background-${value}`} />);
  }, [layersCount]);

  const layouts = React.useMemo(() => generateElements(cols, layers, elements), [cols, layers]);

  const components = React.useMemo(() => layouts.map((item) => (
    <div
      // onClick={() => { popcorn.seek(item.x); }}
      key={item.i}
      data-grid={{
        h: 1,
        minH: 1,
        maxH: 1,
        minW: ms,
        maxW: cols - item.x,
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
      }}
    >
      {item.type}
    </div>
  )), [layouts, cols]);

  const onDragStop = (el, oldEl, newEl) => {
    if (oldEl.y !== newEl.y) {
      setLayer(oldEl.i, newEl.y);
    }
    if (oldEl.x !== newEl.x) {
      const start = newEl.x / ms;
      updateStartEnd(oldEl.i, start, start + newEl.w / ms);
    }
  };
  const onResizeStop = (el, oldEl, newEl) => {
    if (oldEl.x !== newEl.x || oldEl.w !== newEl.w) {
      const start = newEl.x / ms;
      updateStartEnd(oldEl.i, start, start + newEl.w / ms);
    }
  };

  if (!width) {
    return null;
  }

  return (
    <div className="elements">
      <ResponsiveGrid
        cols={cols}
        rowHeight={34}
        maxRows={layersCount}
        layouts={layouts}
        components={components}
        onDragStop={onDragStop}
        onResizeStop={onResizeStop}
        width={width}
        marginTop={1}
        marginLeft={1}
        preventCollision
      />
      <div className="elements-grid">
        {backgroundGrid}
      </div>
    </div>
  );
},
);

// PopcornElements.propTypes = {
//   item: PropTypes.shape({
//     name: PropTypes.string.isRequired,
//     action: PropTypes.func.isRequired,
//   }).isRequired,
// };

export default PopcornElements;
