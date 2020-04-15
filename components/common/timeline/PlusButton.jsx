import React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import SVGPlus from '../../../public/static/svgImages/edit/plus.svg';

import PropTypes from '../../../lib/PropTypes';

const PlusButton = observer(({ onClick, alt, className }) => (
  <SVGInline
    className={className || ''}
    component="button"
    classSuffix=""
    svg={SVGPlus}
    cleanup={['title']}
    onClick={onClick}
    alt={alt || ''}
    data-tip={alt || ''}
  />
));

PlusButton.propTypes = {
  alt: PropTypes.string,
  className: PropTypes.string,
  onClick: PropTypes.func.isRequired,
};


export default PlusButton;
