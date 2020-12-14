import React, { useRef, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react';
import { useDrop } from 'react-dnd';
import { useWindowSize } from '@react-hook/window-size';
import classnames from 'classnames';
import { CircleLoader } from 'react-spinners';

import useProjectStore from './hooks/useProjectStore';
import useUIStore from './hooks/useUIStore';
import {
  DEFAULT_RATIO,
  DEFAULT_VIDEO_WIDTH,
  DEFAULT_FONT_SIZE,
  DEFAULT_CONTAINER,
} from '../lib/constants/project';

import { LOADING_COLOR } from '../lib/constants/ui';
import { acceptedDraggableItems } from '../lib/constants/dragNDropConstants';

import PersonalizerActivation from './common/PersonalizerActivation';
import GuidelinesActivation from './common/GuidelinesActivation';
import Guidelines from './common/Guidelines';

const Canvas = observer(() => {
  const projectStore = useProjectStore();
  const uiStore = useUIStore();
  const {
    item: { ratio: { width, height } = DEFAULT_RATIO },
    runTextfill,
    isLoadingSequencer,
    retarget,
    toggleViewPersonalizer,
    runMapResize,
  } = projectStore;

  const {
    hasGuidLines,
    checkboxLeft,
    checkboxRight,
    isExpand,
    radioButtonBottom,
    isTimelineOpen,
    isCanvasPresent,
    toggleRightBlock,
  } = uiStore;

  const [style, setStyle] = React.useState({});
  const [fontSize, setFontSize] = React.useState(DEFAULT_FONT_SIZE);
  const [windowWidth, windowHeight] = useWindowSize();

  const aspectRatio = useMemo(() => {
    if (!isCanvasPresent) {
      return 0;
    } else {
      return width / height;
    }
  }, [width, height, isCanvasPresent]);

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
  }, [
    aspectRatio,
    windowWidth,
    windowHeight,
    checkboxLeft,
    checkboxRight,
    isExpand,
    radioButtonBottom,
    isTimelineOpen,
  ]);

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
  }, [style]);

  useEffect(() => {
    runTextfill();
    runMapResize();
  }, [fontSize, runTextfill]);

  const onDropElement = ({ action }) => {
    toggleRightBlock();
    action();
  };

  const [{ isOver }, dropRef] = useDrop({
    accept: acceptedDraggableItems,
    drop: onDropElement,
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  return (
    <div ref={ref} className={classnames('stager-wrapper', { 'stager-wrapper-big': !isTimelineOpen })}>
      <GuidelinesActivation marginLeft={style.margin && style.margin.split(' ')[1]} />
      { retarget && retarget.showed ? (
        <PersonalizerActivation
          marginLeft={style.margin && style.margin.split(' ')[1]}
          retarget={retarget}
          togglePersonalizer={toggleViewPersonalizer}
        />
      ) : null}
      <div ref={dropRef} style={{ ...style }} className="embed-wrapper">
        {hasGuidLines && <Guidelines />}

        { isLoadingSequencer ? <div className="hover-loading" /> : null }
        <CircleLoader
          size={100}
          class="loading"
          css={{
            margin: 'auto',
            position: 'absolute',
            top: 0,
            bottom: '0',
            left: '0',
            right: '0',
            zIndex: 10000,
          }}
          loading={isLoadingSequencer}
          color={LOADING_COLOR}
        />

        <div id={DEFAULT_CONTAINER} ref={wrapper} className="video-container" style={{ fontSize }}>
          <div
            id="video"
            className={classnames('video', { 'video-active': isOver })}
            webkit-playsinline="webkit-playsinline"
          />
        </div>
      </div>
    </div>
  );
});

export default Canvas;
