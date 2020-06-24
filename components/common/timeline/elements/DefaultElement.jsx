import * as React from 'react';
import Grid from '@material-ui/core/Grid/Grid';
import PropTypes from '../../../../lib/PropTypes';
import { POPCORN_ELEMENT_LABELS } from '../../../../lib/constants/popcorn';
import useProjectStore from '../../../hooks/useProjectStore';

const DefaultElement = React.forwardRef(({ item, ...rest }, ref) => {
  const { isAudio } = useProjectStore();
  const { contentType, type } = item;

  return (
    <Grid
      container
      className="popcorn-element"
      ref={ref}
      tabIndex={-1}
      title={item.title || item.htmlText || item.type}
      {...rest}
    >
      <span className="popcorn-element-name">
        {POPCORN_ELEMENT_LABELS[item.type] || (isAudio({ popcornOptions: { contentType, type } }) ? 'Audio' : 'Video')}
      </span>
    </Grid>
  );
});

DefaultElement.propTypes = {
  item: PropTypes.shape({
    type: PropTypes.string.isRequired,
    title: PropTypes.string,
    htmlText: PropTypes.string,
  }).isRequired,
};

export default DefaultElement;
