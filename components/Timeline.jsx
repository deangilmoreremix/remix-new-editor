import React, { useRef, useEffect } from 'react';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import { Col, Container, Row } from 'reactstrap';
import arrayMove from 'array-move';
import { observer } from 'mobx-react';

import useProjectStore from './hooks/useProjectStore';

import PlayButton from './common/timeline/PlayButton';
import PopcornElements from './common/timeline/PopcornElements';
import Layer from './common/timeline/Layer';

const SortableItem = SortableElement(({ item }) => <Layer item={item} />);

const SortableList = SortableContainer(({ items, className }) => (
  <ul className={className}>
    {items.map((item) => (
      <SortableItem sortIndex={item.order} className="layer" key={`item-${item.id}`} index={item.order} item={item} />
    ))}
  </ul>
));

const Timeline = observer(() => {
  const projectStore = useProjectStore();
  const { layers, isLoaded } = projectStore;

  // const [currentLayers, setCurrentLayers] = React.useState(Object.values(layers));

  const onSortEnd = ({ oldIndex, newIndex }) => {
    if (oldIndex === newIndex) {
      return;
    }
    const newLayers = (arrayMove(layers, oldIndex, newIndex));

    projectStore.updateOrders(newLayers);
  };

  // const { item: { ratio: { width = 16, height = 9 } = {} } } = projectStore;
  //
  // const [style, setStyle] = React.useState({});
  //
  // const aspectRatio = width / height;
  // const ref = useRef(null);
  // const wrapper = useRef(null);
  // const marginLeft = 20;
  // const marginTop = 20;
  //
  // useEffect(() => {
  //   if (ref.current) {
  //     const maxWidth = ref.current.offsetWidth - (marginLeft * 2);
  //     const maxHeight = ref.current.offsetHeight - (marginTop * 2);
  //     const sideIndent = (maxWidth - (maxHeight * aspectRatio)) / 2;
  //     setStyle(sideIndent > 0 ? { margin: `${marginTop}px ${sideIndent + marginLeft}px` }
  //       : { margin: `${((maxHeight - (maxWidth / aspectRatio))) / 2 + marginTop}px ${marginLeft}px` });
  //   }
  // }, [aspectRatio]);
  //
  // useEffect(() => {
  //   if (wrapper.current) {
  //     projectStore.setPopcorn(wrapper.current);
  //   }
  // }, [projectStore]);
  // todo calculate width
  return (
    <div style={{ width: '100%' }}>
      <PlayButton />
      <div className="layers">
        <Col md={3}>
          <SortableList className="layers-settings" items={layers} onSortEnd={onSortEnd} />
        </Col>
        <Col md={9} className="elements">
          { isLoaded && <PopcornElements /> }
          {/* <div ref={ref} className="stager-wrapper"> */}
          {/* <div style={style} ref={wrapper} className="embed-wrapper"> */}
          {/* <div id="video-container" className="video-container"> */}
          {/* <div */}
          {/* id="video" */}
          {/* className="video" */}
          {/* webkit-playsinline */}
          {/* /> */}
          {/* </div> */}
          {/* </div> */}
          {/* </div> */}
        </Col>
      </div>
    </div>
  );
});

export default Timeline;
