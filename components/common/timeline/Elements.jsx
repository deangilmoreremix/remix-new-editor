import React from 'react';
import { Button, Container } from 'reactstrap';
import { observer } from 'mobx-react';
import GridLayout, { Responsive } from 'react-grid-layout';
// import { Draggable } from 'react-beautiful-dnd';

import Timeline from 'react-calendar-timeline';
import useProjectStore from '../../hooks/useProjectStore';
// make sure you include the timeline stylesheet or the timeline will not be styled
// import 'react-calendar-timeline/lib/Timeline.css';

const layouts = [
  { i: 'a', x: 0, y: 0, w: 1, h: 1 },
  { i: 'b', x: 1, y: 1, w: 3, h: 1 },
  { i: 'c', x: 2, y: 2, w: 4, h: 1 },
];

const generate = () => layouts.map((l) => (
  <div key={l.i} className={l.static ? 'static' : ''}>
    {l.static ? (
      <span
        className="text"
        title="This item is static and cannot be removed or resized."
      >
              Static -
        {' '}
        {l.i}
      </span>
    ) : (
      <div style={{ background: 'red' }} className="text">{l.i}</div>
    )}
  </div>
));

const state = {
  className: 'layout',
  rowHeight: 10,
  cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
  currentBreakpoint: 'lg',
  compactType: 'vertical',
  mounted: false,
  layouts,
};

// todo implement it
// const Elements = observer(() => (
//   <div style={{ width: '100%' }}>
//     <Responsive
//       style={{ position: 'relative' }}
//       layouts={state.layouts}
//       // onBreakpointChange={this.onBreakpointChange}
//       // onLayoutChange={this.onLayoutChange}
//       // onDrop={this.onDrop}
//       // WidthProvider option
//       // measureBeforeMount={false}
//       // I like to have it animate on mount. If you don't, delete `useCSSTransforms` (it's default `true`)
//       // and set `measureBeforeMount={true}`.
//       // useCSSTransforms={state.mounted}
//       // compactType={state.compactType}
//       // preventCollision={state.compactType}
//     >
//       {generate()}
//     </Responsive>
//   </div>
// ),

const t = {};

const generateLayout = (lay) => lay.elements.map(element => {
  const { popcornOptions: { id, start, end }, type } = element;
  const start1 = start * 1000;
  const width = (start + end) * 1000;
  t[id] = { i: id, x: start1, y: lay.order, w: width, h: 1 };
  return (
    <span
      style={{ background: 'red' }}
      key={id}
      data-grid={{ i: id, x: start1, y: lay.order, w: width, h: 1, minH: 1, minW: 1, maxH: 1 }}
    >
      {type}
    </span>
  );
});

const Elements = observer(() => {
  const projectStore = useProjectStore();
  // todo for empty project
  const { popcorn, layers } = projectStore;
  const [duration, setDuration] = React.useState(30);

  // console.info(`readyState = ${popcorn.readyState()}`);

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

  const onDragStop = (e) => {
    const t = e;
    debugger;
  };

  const onResizeStop = (e) => {
    const t = e;
    debugger;
  };
  const onDrag = (elements, element) => {
    // const t = e;
    // const r = s;
  };


  return (
    <div style={{ width: '80%', float: 'left'}}>
      <Responsive
        autoSize={true}
        measureBeforeMount={false}
        className="layout"
        cols={{ md: duration * 1000 }}
        rowHeight={30}
        width={1200}
        compactType={null}
        margin={[1, 5]}
        onResizeStop={onResizeStop}
        onDragStop={onDragStop}
        onDrag={onDrag}
      >
        {layers.map(layer => generateLayout(layer))}
      </Responsive>
    </div>
  );
},
);

// Elements.propTypes = {
//   item: PropTypes.shape({
//     name: PropTypes.string.isRequired,
//     action: PropTypes.func.isRequired,
//   }).isRequired,
// };

export default Elements;
