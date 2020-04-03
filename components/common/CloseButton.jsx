import React from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

import arrowIcon from '../../public/static/svgImages/common/arrow-back.svg';

const CloseButton = ({ onClick, classNames = [] }) => (
  <SVGInline
    className={classnames('close-button', classNames.join(' '))}
    svg={arrowIcon}
    component="button"
    onClick={onClick}
  />
);

CloseButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  classNames: PropTypes.arrayOf(PropTypes.string),
};

export default CloseButton;
