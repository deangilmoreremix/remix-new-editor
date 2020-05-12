import * as React from 'react';
import classnames from 'classnames';
import Grid from '@material-ui/core/Grid/Grid';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../../lib/PropTypes';
import { TIMELINE_ELEMENT_ICONS } from '../../../../lib/constants/timeline';

const IconElement = React.forwardRef(({ item, onSelect, ...rest }, ref) => {
  const icon = React.useMemo(() => TIMELINE_ELEMENT_ICONS[item.type], [item]);

  return (
    <Grid
      container
      className="popcorn-element icon-element"
      onClick={onSelect}
      ref={ref}
      title={item.title || item.htmlText || item.type}
      tabIndex={-1}
      {...rest}
    >
      {icon && (
        <div className={classnames('inner-wrapper', `${item.type}`)}>
          <SVGInline
            className="icon-btn"
            classSuffix="--inline"
            svg={icon}
            cleanup={['title']}
          />
        </div>
      )}
    </Grid>
  );
});

IconElement.propTypes = {
  item: PropTypes.shape({
    type: PropTypes.string.isRequired,
    title: PropTypes.string,
    htmlText: PropTypes.string,
  }).isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default IconElement;
