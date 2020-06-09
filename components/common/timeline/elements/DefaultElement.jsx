import * as React from 'react';
import Grid from '@material-ui/core/Grid/Grid';
import PropTypes from '../../../../lib/PropTypes';

const DefaultElement = React.forwardRef(({ item, ...rest }, ref) => (
  <Grid
    container
    className="popcorn-element"
    ref={ref}
    tabIndex={-1}
    title={item.title || item.htmlText || item.type}
    {...rest}
  >
    <span className="popcorn-element-name">
      {item.title || item.htmlText || item.type}
    </span>
  </Grid>
));

DefaultElement.propTypes = {
  item: PropTypes.shape({
    type: PropTypes.string.isRequired,
    title: PropTypes.string,
    htmlText: PropTypes.string,
  }).isRequired,
};

export default DefaultElement;
