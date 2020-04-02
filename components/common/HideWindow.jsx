import React from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

import arrowIcon from '../../public/static/svgImages/common/arrow-back.svg';

const HideWindow = ({ onClick, classNames = [] }) => (
  <SVGInline
    className={classnames('hide-window', classNames.join(' '))}
    svg={arrowIcon}
    component="button"
    onClick={onClick}
  />
);

HideWindow.propTypes = {
  onClick: PropTypes.func.isRequired,
  classNames: PropTypes.arrayOf(PropTypes.string),
};

export default HideWindow;
