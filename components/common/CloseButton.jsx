import React from 'react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';

import arrowIcon from '../../public/static/svgImages/common/arrow-back.svg';

const CloseButton = ({ onClick, className, isTabs }) => (
  <SVGInline
    className={`${className || 'close-button'} ${isTabs ? 'multi-close-button' : ''}`}
    svg={arrowIcon}
    component="button"
    onClick={onClick}
  />
);

CloseButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  className: PropTypes.string,
  isTabs: PropTypes.bool,
};

CloseButton.defaultProps = {
  isTabs: false,
};

export default CloseButton;
