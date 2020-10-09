import React, { useState } from 'react';
import PropTypes from 'prop-types';
import HelpIconComponent from './HelpIcon';

const TimeoutTooltip = ({ children, message }) => {
  let tooltipTime;

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
    >
      {children}
      <HelpIconComponent
        noIcon
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
};

export default TimeoutTooltip;
