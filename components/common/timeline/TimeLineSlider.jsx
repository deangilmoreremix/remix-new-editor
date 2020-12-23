import React, { useEffect, useMemo } from 'react';
import Slider from '@material-ui/core/Slider';
import classnames from 'classnames';
import { observer } from 'mobx-react';
import moment from 'moment';

import PropTypes from '../../../lib/PropTypes';
import useUIStore from '../../hooks/useUIStore';
import useProjectStore from '../../hooks/useProjectStore';

import LineSlider from './LineSlider';

const TimeLineSlider = observer((props) => {
  const {
    containerClassName,
    sliderClassName,
    disabled,
    startDate,
    endDate,
    startDateWithZoom,
    endDateWithZoom,
    setStartDateWithZoom,
    setEndDateWithZoom,
  } = props;

  const { isTimelineOpen } = useUIStore();
  const { duration, updateTime, time, isPlayed, layers } = useProjectStore();

  const layersCount = React.useMemo(() => layers.length, [layers.length]);

  useEffect(() => {
    const thumb = document.querySelector('.timeline .MuiSlider-thumb');
    const sliderDuration = time * 10;
    const sliderStart = startDateWithZoom.diff(startDate);
    const sliderEnd = endDateWithZoom.diff(startDate);
    if ((sliderDuration < sliderStart || sliderDuration > sliderEnd) && !isPlayed) {
      thumb.style.display = 'none';
    } else {
      thumb.style.display = 'flex';
    }
  }, [time, startDateWithZoom, endDateWithZoom, isPlayed]);

  const minValue = useMemo(() => {
    if (!startDateWithZoom) {
      return null;
    }
    const min = startDateWithZoom.diff(startDate) / 10;
    if (min > 0) {
      return min;
    } else {
      return 0;
    }
  }, [startDateWithZoom]);

  const maxValue = useMemo(() => {
    if (!endDateWithZoom) {
      return null;
    }
    const max = endDateWithZoom.diff(startDate) / 10;
    if (max < duration) {
      return max;
    } else {
      return duration;
    }
  }, [endDateWithZoom, duration]);

  const handleSliderChange = (event, newValue) => {
    if (newValue * 10 === endDateWithZoom.diff(startDate) && !endDateWithZoom.isSame(endDate)) {
      // slider end
      const newEnd = moment(startDateWithZoom.diff(0) + 1000);
      if (newEnd.diff(endDate) > 0) {
        setStartDateWithZoom(
          moment(endDateWithZoom.diff(0) - endDateWithZoom.diff(startDateWithZoom)),
        );
        setEndDateWithZoom(endDate);
        updateTime((endDate.diff(startDate)) / 10);
      } else {
        setStartDateWithZoom(moment(startDateWithZoom.diff(0) + 1000));
        setEndDateWithZoom(newEnd);
        updateTime(newValue + 100);
      }
    } else if (newValue * 10 === startDateWithZoom.diff(startDate)
      && !startDateWithZoom.isSame(startDate)) {
      // slider start
      const newStart = moment(startDateWithZoom.diff(0) - 1000);
      if (newStart.diff(startDate) < 0) {
        setStartDateWithZoom(startDate);
        setEndDateWithZoom(
          moment(startDate.diff(0) - endDateWithZoom.diff(startDateWithZoom)),
        );
        updateTime(0);
      } else {
        setStartDateWithZoom(newStart);
        setEndDateWithZoom(moment(endDateWithZoom.diff(0) - 1000));
        updateTime(newValue - 100);
      }
    } else {
      updateTime(newValue);
    }
  };

  // If the timeline has more than 4 layers, a scroll appears.
  // Therefore, plus 6 px must be added to the right hand side for the slider.
  const marginRight = useMemo(() => (layersCount > 4 ? '20px' : '14px'), [layersCount]);

  return (
    <div className={classnames(containerClassName, 'slider-element', { 'slider-element-hidden': !isTimelineOpen })} style={{ marginRight }}>
      <Slider
        className={classnames(sliderClassName)}
        value={time}
        onChange={handleSliderChange}
        aria-labelledby="input-slider"
        max={maxValue}
        min={minValue}
        disabled={disabled}
      />
      {
        isTimelineOpen && (
          <div className="line-slider">
            <LineSlider
              startDate={startDate}
              endDate={endDate}
              startDateWithZoom={startDateWithZoom}
              endDateWithZoom={endDateWithZoom}
            />
          </div>
        )
      }
    </div>
  );
});

TimeLineSlider.propTypes = {
  containerClassName: PropTypes.string,
  sliderClassName: PropTypes.string,
  disabled: PropTypes.bool,
  startDate: PropTypes.shape({}),
  endDate: PropTypes.shape({}),
  startDateWithZoom: PropTypes.shape({}),
  endDateWithZoom: PropTypes.shape({}),
};

TimeLineSlider.defaultProps = {
  disabled: false,
};

export default TimeLineSlider;
