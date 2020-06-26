import * as React from 'react';
import classnames from 'classnames';
import Grid from '@material-ui/core/Grid/Grid';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../../lib/PropTypes';

// TODO: change to  import svgLoopIcon from '../../../../public/static/svgImages/popcorn/loop.svg';
import svgLoopIcon from '../../../../public/static/images/toolbar/loop.svg';
import svgInfiniteIcon from '../../../../public/static/svgImages/popcorn/infinite.svg';
import { POPCORN_ELEMENT_LABELS } from '../../../../lib/constants/popcorn';

const IconElement = React.forwardRef(({ item, onSelect, ...rest }, ref) => (
  <Grid
    container
    className="popcorn-element icon-element popcorn-loop-element"
    onClick={onSelect}
    ref={ref}
    title={item.type}
    tabIndex={-1}
    {...rest}
  >
    <div className={classnames('inner-wrapper', 'popcorn-loop')}>
      <SVGInline
        className="icon-btn"
        classSuffix="--inline"
        svg={svgLoopIcon}
        cleanup={['title']}
      />
    </div>
    <div>
      {POPCORN_ELEMENT_LABELS[item.type]}
    </div>
    {
      item.loop === 0
      && (
        <div className={classnames('inner-wrapper', 'popcorn-loop-end')}>
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
    loop: PropTypes.number,
  }).isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default IconElement;
