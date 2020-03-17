import React from 'react';
import { observer } from 'mobx-react';
import _ from 'lodash';

import useProjectStore from '../../hooks/useProjectStore';
import ResponsiveGrid from '../../form/grids/ResponsiveGrid';

const ms = 1000;

const generateComponent = (options) => (
  <div
    style={{ background: 'red' }}
    key={options.i}
    data-grid={{
      h: 1,
      minH: 1,
      maxH: 1,
      minW: ms,
      i: options.i,
      x: options.x,
      y: options.y,
      w: options.w,
    }}
  >
    {options.type}
  </div>
);

const generateElements = (elements, layers) => {
  const result = [];
  elements.forEach(element => {
    const { popcornOptions: { id: i, start, end }, type } = element;
    const x = start * ms;
    const w = (end - start) * ms;
    const y = layers[element.layerId].order;
    result.push({ i, x, w, h: 1, y, static: false, type });
  });
  return result;
};

const PopcornElements = observer(() => {
  const projectStore = useProjectStore();
  // todo for empty project
  const { popcorn, layers, elements, setLayer } = projectStore;
  const [duration, setDuration] = React.useState(30);

  const cols = React.useMemo(() => duration * ms, [duration]);

  const layersCount = React.useMemo(() => _.size(layers), [layers]);

  const layouts = React.useMemo(() => generateElements(elements, layers), [elements, layers]);

  const components = React.useMemo(() => layouts.map((item) => generateComponent(item)), [layouts]);

  if (!popcorn || !popcorn.on) {
    return <div>Loading</div>;
  }

  popcorn.on('canplayall', () => {
    console.info(`duration = ${popcorn.duration()}`);
    const newDuration = popcorn.duration();
    if (duration !== newDuration) {
      setDuration(newDuration);
    }
  });

  const onDragStop = (el, oldEl, newEl) => {
    if (oldEl.y === newEl.y) {
      return;
    }
    setLayer(oldEl.i, newEl.y)
    debugger;
  };

  return (
    <div style={{ width: '80%', float: 'right' }}>
      <ResponsiveGrid
        cols={cols}
        rowHeight={30}
        maxRows={layersCount}
        layouts={layouts}
        components={components}
        onDragStop={onDragStop}
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
