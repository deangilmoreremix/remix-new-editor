import React, { useMemo } from 'react';
import Timeline from 'timeline/lib/index';
import PropTypes from 'prop-types';
import moment from 'moment';
import { observer } from 'mobx-react';

import useProjectStore from '../../hooks/useProjectStore';
import { SANTISECOND } from '../../../lib/constants/project';

const LineSlider = observer(({ startDate, endDate, startDateWithZoom, endDateWithZoom }) => {
  const { duration } = useProjectStore();

  const layouts = [
    {
      key: 1,
      row: 0,
      start: startDate,
      end: endDate,
      isResizable: false,
    },
  ];

  const line = useMemo(() => {
    const array = [];
    const maxI = duration / SANTISECOND;
    const stampNum = parseInt(maxI / 30, 10) || 1;
    for (let i = 0; i <= maxI; i++) {
      array.push(i);
    }
    // eslint-disable-next-line array-callback-return
    return array.map(el => {
      if (el * stampNum <= maxI) {
        if (el % 2 === 0 && el !== maxI) {
          const momentTime = moment.duration(el * stampNum, 'seconds');
          const stamp = moment({ minutes: 0, seconds: 0 }).add(momentTime).format('mm:ss');
          return (
            <div className="line-slider-item" key={el}>
              <div className="line-slider-block" />
              <div className="line-slider-number">
                {stamp}
              </div>
            </div>
          );
        } else if (el === maxI && el % 2 === 0) {
          return (
            <div className="line-slider-item" key={el}>
              <div className="line-slider-block" />
            </div>
          );
        } else {
          return (
            <div className="line-slider-item" key={el}>
              <div className="line-slider-little-block" />
            </div>
          );
        }
      }
    });
  }, [duration, endDateWithZoom]);

  const components = React.useMemo(() => layouts.map(item => {
    item.render = (props) => (
      <span className="line-slider-element" {...props}>
        {line}
      </span>
    );
    return item;
  }), [line]);

  if (startDateWithZoom && endDateWithZoom) {
    return (
      <Timeline
        shallowUpdateCheck
        items={components}
        groups={[{ id: 0 }]}
        startDate={startDateWithZoom}
        endDate={endDateWithZoom}
        originalStartDate={startDate}
        originalEndDate={endDate}
        onInteraction={() => {}}
        itemHeight={29}
        componentId="timeline-line"
        withDragSelection={false}
        layersNumber={1}
      />
    );
  }
  return null;
});

LineSlider.propTypes = {
  startDate: PropTypes.shape({}).isRequired,
  endDate: PropTypes.shape({
    diff: PropTypes.func.isRequired,
  }).isRequired,
  startDateWithZoom: PropTypes.shape({}).isRequired,
  endDateWithZoom: PropTypes.shape({}).isRequired,
};

export default LineSlider;
