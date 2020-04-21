import React, { useRef, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react';
import { useWindowSize } from '@react-hook/window-size';

import useProjectStore from './hooks/useProjectStore';
import {
  DEFAULT_RATIO,
  DEFAULT_VIDEO_WIDTH,
  DEFAULT_FONT_SIZE,
  DEFAULT_CONTAINER,
} from '../lib/constants/project';

import GuidelinesActivation from './common/GuidelinesActivation';
import Guidelines from './common/Guidelines';

const Canvas = observer(() => {
  const projectStore = useProjectStore();
  const {
    item: { ratio: { width, height } = DEFAULT_RATIO }, runTextfill, isGuideLines,
  } = projectStore;
  const [style, setStyle] = React.useState({});
  const [fontSize, setFontSize] = React.useState(DEFAULT_FONT_SIZE);
  const [windowWidth, windowHeight] = useWindowSize();

  const aspectRatio = useMemo(() => width / height, [width, height]);

  const ref = useRef(null);
  const wrapper = useRef(null);
  const marginLeft = 20;
  const marginTop = 60;

  useEffect(() => {
    if (ref.current) {
      const maxWidth = ref.current.offsetWidth - (marginLeft * 2);
      const maxHeight = ref.current.offsetHeight - (marginTop * 2);
      const sideIndent = (maxWidth - (maxHeight * aspectRatio)) / 2;
      setStyle(sideIndent > 0 ? { margin: `${marginTop}px ${sideIndent + marginLeft}px` }
        : { margin: `${((maxHeight - (maxWidth / aspectRatio))) / 2 + marginTop}px ${marginLeft}px` });
    }
  }, [aspectRatio, windowWidth, windowHeight]);

  useEffect(() => {
    if (wrapper.current) {
      projectStore.setPopcorn(wrapper.current);
    }
  }, [projectStore]);

  useEffect(() => {
    if (wrapper.current) {
      setFontSize(`${DEFAULT_FONT_SIZE * (wrapper.current.offsetWidth / DEFAULT_VIDEO_WIDTH)}px`);
      runTextfill();
    }
  }, [runTextfill, style]);

  useEffect(() => {
    runTextfill();
  }, [fontSize, runTextfill]);

  return (
    <div ref={ref} className="stager-wrapper">
      <GuidelinesActivation />
      <div style={{ ...style, fontSize }} className="embed-wrapper">
        {isGuideLines && <Guidelines />}
        <div id={DEFAULT_CONTAINER} ref={wrapper} className="video-container">
          <div
            id="video"
            className="video"
            webkit-playsinline="webkit-playsinline"
          />
        </div>
      </div>
    </div>
  );
});

export default Canvas;
