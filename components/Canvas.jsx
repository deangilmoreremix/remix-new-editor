import React, { useRef, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react';

import SizeSelector from './canvas/SizeSelector';
import { CANVAS_SIZES } from '../lib/constants/media';
import useProjectStore from './hooks/useProjectStore';

const Canvas = observer(() => {
  const projectStore = useProjectStore();
  const { item: { ratio: { width = 16, height = 9 } = {} }, setRatio } = projectStore;

  const [style, setStyle] = React.useState({});

  const aspectRatio = useMemo(() => width / height, [width, height]);

  const ref = useRef(null);
  const wrapper = useRef(null);
  const marginLeft = 0;
  const marginTop = 0;

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
    }
  }, [projectStore]);

  return (
    <div className="canvas-container">
      <SizeSelector sizes={CANVAS_SIZES} onChange={setRatio} active={{ width, height }} />
      <div ref={ref} className="stager-wrapper">
        <div style={style} ref={wrapper} className="embed-wrapper">
          <div id="video-container" className="video-container">
            <div
              id="video"
              className="video"
              webkit-playsinline="webkit-playsinline"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default Canvas;
