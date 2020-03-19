import React from 'react';
import { observer } from 'mobx-react';
import _ from 'lodash';

import useProjectStore from '../../hooks/useProjectStore';
import ResponsiveGrid from '../../form/grids/ResponsiveGrid';

const ms = 1000;

const generateComponent = (options, cols) => (
  <div
    style={{ background: 'red' }}
    key={options.i}
    data-grid={{
      h: 1,
      minH: 1,
      maxH: 1,
      minW: ms,
      maxW: cols - options.x,
      i: options.i,
      x: options.x,
      y: options.y,
      w: options.w,
    }}
  >
    {options.type}
  </div>
);

const generateElements = (elements, cols) => {
  const result = [];
  elements.forEach(element => {
    const { popcornOptions: { id: i, start, end }, type, order } = element;
    const x = start * ms;
    const w = (end - start) * ms;
    result.push({
      i,
      x,
      w,
      h: 1,
      y: order,
      type,
      minH: 1,
      maxH: 1,
      minW: ms,
      maxW: cols - x,
    });
  });
  return result;
};

const PopcornElements = observer(() => {
  const projectStore = useProjectStore();
  // todo for empty project
  const { duration, layers, elements, setLayer, updateStartEnd } = projectStore;

  const cols = React.useMemo(() => duration * ms, [duration]);

  const layersCount = React.useMemo(() => _.size(layers), [layers]);

  const layouts = React.useMemo(() => generateElements(elements, cols), [elements, cols]);

  const components = React.useMemo(() => layouts.map((item) => generateComponent(item, cols)), [layouts, cols]);

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

  return (
    <div>
      <ResponsiveGrid
        cols={cols}
        rowHeight={30}
        maxRows={layersCount}
        layouts={layouts}
        components={components}
        onDragStop={onDragStop}
        onResizeStop={onResizeStop}
        width={1200}
        marginTop={5}
        marginLeft={1}
        preventCollision
      />
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
