import * as React from 'react';
import classnames from 'classnames';
import Grid from '@material-ui/core/Grid/Grid';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../../lib/PropTypes';

import svgPauseIcon from '../../../../public/static/svgImages/popcorn/pause.svg';
import svgInfiniteIcon from '../../../../public/static/svgImages/popcorn/infinite.svg';

const IconElement = React.forwardRef(({ item, onSelect, ...rest }, ref) => (
  <Grid
    container
    className="popcorn-element icon-element popcorn-pause-element"
    onClick={onSelect}
    ref={ref}
    title={item.type}
    tabIndex={-1}
    {...rest}
  >
    <div className={classnames('inner-wrapper', 'popcorn-pause')}>
      <SVGInline
        className="icon-btn"
        classSuffix="--inline"
        svg={svgPauseIcon}
        cleanup={['title']}
      />
    </div>
    {
      item.duration === 0
      && (
      <div className={classnames('inner-wrapper', 'popcorn-pause-end')}>
        <SVGInline
          className="icon-btn"
          classSuffix="--inline"
          svg={svgInfiniteIcon}
          cleanup={['title']}
        />
      </div>
      )
    }
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
