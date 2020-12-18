import React, { useRef, useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import Grid from '@material-ui/core/Grid';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';
import { useWindowSize } from '@react-hook/window-size';
import moment from 'moment';
import Scroll from 'timeline/lib/scroll';

import useProjectStore from './hooks/useProjectStore';
import useUIStore from './hooks/useUIStore';
import useTimelineStore from './hooks/useTimelineStore';

import TimeLineSlider from './common/timeline/TimeLineSlider';
import Layer from './common/timeline/Layer';
import SortableList from './common/SortableList';
import PlayButton from './common/timeline/PlayButton';
import PlusButton from './common/timeline/PlusButton';
import PlayTime from './common/timeline/PlayTime';
import PopcornElements from './common/timeline/PopcornElements';

import plusIcon from '../public/static/svgImages/timeline/plus.svg';
import minusIcon from '../public/static/svgImages/timeline/minus.svg';
import resetIcon from '../public/static/svgImages/timeline/reset.svg';
import { mainTooltips } from '../lib/constants/tooltips';
import HelpIconComponent from './common/HelpIcon';
import ContextMenu from './common/timeline/ContextMenu';

const date = '2018-08-01 00:00:00';

const Timeline = observer(() => {
  const sortableRef = useRef(null);
  const layersRef = useRef(null);
  const projectStore = useProjectStore();
  const uiStore = useUIStore();
  const [sortableWidth, setSortableWidth] = React.useState(0);
  const [windowWidth] = useWindowSize();

  const {
    layers,
    duration,
    isLoaded,
    addLayer,
    removeLayer,
    moveElements,
    isPlayed,
    time,
    stopIfPlay,
  } = projectStore;

  const { isTimelineOpen, toggleTimeLine } = uiStore;

  const { contextMenu } = useTimelineStore();

  const startDate = moment(date);
  const [endDate, setEndDate] = useState(moment(date));
  const [zoom, setZoom] = useState(1);
  const [isShowScroll, setIsShowScroll] = useState(false);
  const [startDateWithZoom, setStartDateWithZoom] = useState(startDate);
  const [endDateWithZoom, setEndDateWithZoom] = useState(startDate);

  // If the slider is out of sight.
  useEffect(() => {
    const sliderDuration = endDateWithZoom.diff(startDate);
    const startZoom = startDateWithZoom.diff(startDate);
    if (time * 10 >= sliderDuration && sliderDuration !== duration * 10 && isPlayed) {
      // end
      const newStartZoom = startDate.diff(0) + time * 10;
      const newEndZoom = startDate.diff(0) + sliderDuration + time * 10;
      setStartDateWithZoom(moment(newStartZoom));
      setEndDateWithZoom(moment(newEndZoom));
    }
    if (time * 10 < startZoom && startZoom !== 0 && isPlayed) {
      // start
      let newStartZoom = startDate.diff(0) + time * 10;
      let newEndZoom = startDate.diff(0) + sliderDuration + time * 10;
      if (time > 10) {
        newStartZoom -= 100;
        newEndZoom -= 100;
      }
      setEndDateWithZoom(moment(newEndZoom));
      setStartDateWithZoom(moment(newStartZoom));
    }
  }, [duration, time, endDateWithZoom, startDateWithZoom, isPlayed]);

  useEffect(() => {
    setEndDate(moment(startDate.diff(0) + (duration * 10)));
  }, [duration]);

  // update endDateWithZoom
  useEffect(() => {
    const newEnd = moment(startDateWithZoom.diff(0) + (endDate.diff(startDate) * zoom));
    if (!endDateWithZoom || (endDateWithZoom.diff(0) !== newEnd.diff(0))) {
      if (endDate.diff(newEnd) <= 0) {
        setStartDateWithZoom(moment(startDateWithZoom.diff(0) - newEnd.diff(endDate)));
        setEndDateWithZoom(endDate);
      }
      setEndDateWithZoom(newEnd);
      if (+zoom !== 1) {
        setIsShowScroll(true);
      } else {
        setStartDateWithZoom(startDate);
        setEndDateWithZoom(endDate);
        setIsShowScroll(false);
      }
    }
  }, [endDate, zoom, startDateWithZoom]);

  const zoomIn = () => {
    if (zoom > 0.1) {
      setZoom((zoom - 0.1).toFixed(1));
    }
  };

  const zoomOut = () => {
    const newValue = (+zoom + 0.1).toFixed(1);
    if (newValue <= 1) {
      setZoom(newValue);
    }
  };

  const zoomReset = () => {
    setZoom(1);
  };

  const onSortEnd = ({ oldIndex, newIndex }) => {
    if (oldIndex === newIndex) {
      return;
    }
    moveElements(oldIndex, newIndex);
  };

  useEffect(() => {
    if (sortableRef.current) {
      setSortableWidth(sortableRef.current.offsetWidth);
    }
  }, [windowWidth]);

  return (
    <div className="timeline">
      <button
        className={classnames('timeline-arrow', { 'timeline-arrow-open': isTimelineOpen })}
        onClick={() => toggleTimeLine(!isTimelineOpen)}
      />

      <div className="timeline-zoom">
        <button className="timeline-zoom__btn" onClick={zoomIn}>
          <SVGInline
            className="plusIcon"
            svg={plusIcon}
          />
        </button>
        <button className="timeline-zoom__btn" onClick={zoomOut}>
          <SVGInline
            className="plusIcon"
            svg={minusIcon}
          />
        </button>
        <button className="timeline-zoom__btn timeline-zoom__reset" onClick={zoomReset}>
          <SVGInline
            className="plusIcon"
            svg={resetIcon}
          />
        </button>
      </div>

      <div className="timeline-top">
        <div className="timeline-top-left">
          <Grid container alignItems="center" className="timeline__btns">
            {isLoaded && (
              <PlayButton
                startDate={startDate}
                endDateWithZoom={endDateWithZoom}
              />
            )}
            <div className="tooltip-box">
              <PlusButton
                onClick={() => addLayer()}
                alt="Add Layer"
                className="timeline-add icon-button"
              />
              <HelpIconComponent placement="right-start" noPadding message={mainTooltips.timeline} />
            </div>
            <PlayTime />
          </Grid>
        </div>
        {
          isLoaded && (
            <TimeLineSlider
              startDate={startDate}
              endDate={endDate}
              startDateWithZoom={startDateWithZoom}
              endDateWithZoom={endDateWithZoom}
              setStartDateWithZoom={setStartDateWithZoom}
              setEndDateWithZoom={setEndDateWithZoom}
            />
          )
        }
      </div>

      {contextMenu?.buttons.length && contextMenu.isOpen ? <ContextMenu /> : null}

      <div className="layers">
        <SortableList
          sortableRef={sortableRef}
          className="layers-settings"
          items={layers}
          onSortEnd={onSortEnd}
          component={Layer}
          idField="order"
          onRemove={(item) => removeLayer(item.id)}
        />
        <div className="timeline-side">
          { isLoaded && (
            <PopcornElements
              startDate={startDate}
              endDate={endDate}
              startDateWithZoom={startDateWithZoom}
              endDateWithZoom={endDateWithZoom}
              zoom={zoom}
              sortableWidth={sortableWidth}
              layersRef={layersRef}
            />
          )}
        </div>
      </div>
      <div className="layers-scroll-block">
        <div className="layers-scroll-block__hidden" />
        {isShowScroll && (
          <Scroll
            startDate={startDate}
            endDate={endDate}
            scrollBarStart={startDateWithZoom}
            scrollBarEnd={endDateWithZoom}
            setStartDateWithZoom={setStartDateWithZoom}
            setEndDateWithZoom={setEndDateWithZoom}
            scrollEffect={stopIfPlay}
          />
        )}
      </div>
    </div>
  );
});

export default Timeline;
