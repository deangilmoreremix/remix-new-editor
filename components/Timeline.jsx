import React, { useRef, useEffect } from 'react';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import { Container } from 'reactstrap';
import arrayMove from 'array-move';
import { observer } from 'mobx-react';

import useProjectStore from './hooks/useProjectStore';

import PlayButton from './common/timeline/PlayButton';
import Layer from './common/timeline/Layer';

const SortableItem = SortableElement(({ item }) => <Layer item={item} />);

const SortableList = SortableContainer(({ items }) => (
  <ul>
    {items.map((item, index) => (
      <SortableItem sortIndex={item.order} key={`item-${item}`} index={index} item={item} />
    ))}
  </ul>
));

const Timeline = observer(() => {
  const projectStore = useProjectStore();
  const { layers, videoElements, audioElements } = projectStore;

  const [currentLayers, setCurrentLayers] = React.useState(layers);

  const onSortEnd = ({ oldIndex, newIndex }) => {
    setCurrentLayers(arrayMove(currentLayers, oldIndex, newIndex));
    projectStore.sortLayers(currentLayers);
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

  return (
    <div>
      <SortableList items={currentLayers} onSortEnd={onSortEnd} />
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
    </div>);
});

export default Timeline;
