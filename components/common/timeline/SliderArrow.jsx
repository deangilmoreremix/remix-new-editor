import React, { useMemo } from 'react';
import { useWindowSize } from '@react-hook/window-size';

import useUIStore from '../../hooks/useUIStore';
import useProjectStore from '../../hooks/useProjectStore';
import timelineArrowPosition from '../../../lib/utils/timelineArrowPosition';

import PropTypes from '../../../lib/PropTypes';

const SliderArrow = React.memo(({
  sortableWidth,
  time,
  timelineSideRef,
  startDateWithZoom,
  endDateWithZoom,
  startDate,
}) => {
  const { isPlayed } = useProjectStore();
  const { isTimelineOpen } = useUIStore();
  const [windowWidth] = useWindowSize();

  const style = useMemo(() => {
    if (!timelineSideRef?.current) {
      return null;
    }

    return timelineArrowPosition({
      time,
      startDateWithZoom,
      startDate,
      endDateWithZoom,
      isPlayed,
      timelineSideRef,
      sortableWidth,
    });
  }, [time, startDateWithZoom, endDateWithZoom, sortableWidth, windowWidth]);

  const arrowDisplay = useMemo(() => (isTimelineOpen ? 'block' : 'none'), [isTimelineOpen]);

  return (
    <div
      className="slider-arrow"
      style={{ display: arrowDisplay, ...style }}
    />
  );
});

SliderArrow.propTypes = {
  sortableWidth: PropTypes.number,
  time: PropTypes.number,
  startDateWithZoom: PropTypes.shape(),
  endDateWithZoom: PropTypes.shape(),
  startDate: PropTypes.shape(),
  timelineSideRef: PropTypes.shape(),
};

export default SliderArrow;
