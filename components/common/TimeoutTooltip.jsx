import React, { useState } from 'react';
import PropTypes from 'prop-types';
import HelpIconComponent from './HelpIcon';

const TimeoutTooltip = (props) => {
  let tooltipTime;

  const {
    children,
    message,
    className,
    isLeft,
    isBottom,
    isTop,
    isTimeline,
    isProduce,
  } = props;

  const [tooltip, setTooltip] = useState(false);

  const handleTooltipMouseEntered = () => {
    tooltipTime = setTimeout(
      () => setTooltip(true), 1000,
    );
  };

  const handleTooltipMouseLeave = () => {
    clearTimeout(tooltipTime);
    setTooltip(false);
  };

  return (
    <div
      onMouseEnter={handleTooltipMouseEntered}
      onMouseLeave={handleTooltipMouseLeave}
      className={className}
    >
      {children}
      <HelpIconComponent
        noIcon
        isProduce={isProduce}
        isTop={isTop}
        isLeft={isLeft}
        isBottom={isBottom}
        isTimeline={isTimeline}
        message={message}
        onParentMouseEntered={tooltip}
      />
    </div>
  );
};

TimeoutTooltip.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
  message: PropTypes.string.isRequired,
  className: PropTypes.string,
  isLeft: PropTypes.bool,
  isBottom: PropTypes.bool,
  isTop: PropTypes.bool,
  isTimeline: PropTypes.bool,
  isProduce: PropTypes.bool,
};

export default TimeoutTooltip;
