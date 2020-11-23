import * as React from 'react';
import ContentEditable from 'react-contenteditable';
import Grid from '@material-ui/core/Grid/Grid';
import PropTypes from '../../../../lib/PropTypes';
import { POPCORN_ELEMENT_LABELS } from '../../../../lib/constants/popcorn';
import { wrapTokens } from '../../../../lib/utils/tokens-helper';

const DefaultElement = React.forwardRef(({ item, ...rest }, ref) => (
  <Grid
    container
    className="popcorn-element"
    ref={ref}
    tabIndex={-1}
    title={item.type || item.title || item.htmlText}
    {...rest}
  >
    <span className="popcorn-element-name">
      {item.htmlText ? (
        <ContentEditable
          className="popcorn-element-text"
          tagName="span"
          html={wrapTokens(item.htmlText)}
          onChange={() => {
          }}
        />
      ) : POPCORN_ELEMENT_LABELS[item.type]}
    </span>
  </Grid>
));

DefaultElement.propTypes = {
  item: PropTypes.shape({
    type: PropTypes.string.isRequired,
    title: PropTypes.string,
    htmlText: PropTypes.string,
    contentType: PropTypes.string,
  }).isRequired,
};

export default DefaultElement;
