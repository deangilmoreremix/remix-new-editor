import React from 'react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';

import arrowIcon from '../../public/static/svgImages/common/arrow-back.svg';

const CloseButton = ({ onClick, classNames }) => (
  <SVGInline
    className={`close-button ${classNames}`}
    svg={arrowIcon}
    component="button"
    onClick={onClick}
  />
);

CloseButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  classNames: PropTypes.string,
};

export default CloseButton;
