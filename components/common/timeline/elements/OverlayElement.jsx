import * as React from 'react';
import classnames from 'classnames';
import Grid from '@material-ui/core/Grid/Grid';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../../lib/PropTypes';

import svgOverlayIcon from '../../../../public/static/images/toolbar/overlay.svg';
import { POPCORN_ELEMENT_LABELS } from '../../../../lib/constants/popcorn';

const IconElement = React.forwardRef(({ item, onSelect, ...rest }, ref) => (
  <Grid
    container
    className="popcorn-element popcorn-element-overlay icon-element"
    onClick={onSelect}
    ref={ref}
    title={item.type}
    tabIndex={-1}
    {...rest}
  >
    <div className={classnames('inner-wrapper', 'popcorn-overlay')}>
      <SVGInline
        className="icon-btn"
        classSuffix="--inline"
        svg={svgOverlayIcon}
        cleanup={['title']}
      />
    </div>
    <div className="popcorn-overlay-title">
      {POPCORN_ELEMENT_LABELS[item.type]}
    </div>
  </Grid>
));

IconElement.propTypes = {
  item: PropTypes.shape({
    type: PropTypes.string.isRequired,
    title: PropTypes.string,
    htmlText: PropTypes.string,
    duration: PropTypes.number,
  }).isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default IconElement;
