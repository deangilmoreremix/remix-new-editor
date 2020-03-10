import React, { useRef, useEffect } from 'react';
import { Container } from 'reactstrap';

import useProjectStore from './hooks/useProjectStore';

const Canvas = () => {
  const projectStore = useProjectStore();
  const { item: { ratio: { width = 16, height = 9 } = {} } } = projectStore;

  const [style, setStyle] = React.useState({});
  const [popcorn, setPopcorn] = React.useState();

  const aspectRatio = width / height;
  const ref = useRef(null);
  const wrapper = useRef(null);
  const marginLeft = 20;
  const marginTop = 20;

  useEffect(() => {
    if (ref.current) {
      const maxWidth = ref.current.offsetWidth - (marginLeft * 2);
      const maxHeight = ref.current.offsetHeight - (marginTop * 2);
      const sideIndent = (maxWidth - (maxHeight * aspectRatio)) / 2;
      setStyle(sideIndent > 0 ? { margin: `${marginTop}px ${sideIndent + marginLeft}px` }
        : { margin: `${((maxHeight - (maxWidth / aspectRatio))) / 2 + marginTop}px ${marginLeft}px` });
    }
  }, [aspectRatio]);

  useEffect(() => {
    if (wrapper.current) {
      projectStore.setPopcorn(wrapper.current);
      setPopcorn(projectStore.popcorn);
      console.info(popcorn);
    }
  }, []);

  return (
    <div ref={ref} className="stager-wrapper">
      <div style={style} ref={wrapper} className="embed-wrapper" />
    </div>
  );
};

export default Canvas;
