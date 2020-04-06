import React from 'react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';

import arrowIcon from '../../public/static/svgImages/common/arrow-back.svg';

const CloseButton = ({ onClick, className }) => (
  <SVGInline
    className={`close-button ${className}`}
    svg={arrowIcon}
    component="button"
    onClick={onClick}
  />
);

CloseButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export default CloseButton;
