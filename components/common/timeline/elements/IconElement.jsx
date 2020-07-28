import * as React from 'react';
import classnames from 'classnames';
import Grid from '@material-ui/core/Grid/Grid';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../../lib/PropTypes';
import {
  TIMELINE_ELEMENT_DEFAULT_FIELD as DEFAULT_FIELD,
  TIMELINE_ELEMENT_DEFAULT_ICONS,
  TIMELINE_ELEMENT_ICONS,
} from '../../../../lib/constants/timeline';
import { DEFAULT_SETTINGS } from '../../../../lib/constants/settings';
import { POPCORN_ELEMENT_LABELS } from '../../../../lib/constants/popcorn';

const IconElement = React.forwardRef(({ item, onSelect, ...rest }, ref) => {
  const icon = React.useMemo(() => TIMELINE_ELEMENT_ICONS[item.type], [item]);
  const defaultIcon = React.useMemo(() => TIMELINE_ELEMENT_DEFAULT_ICONS[item.type], [item]);

  return (
    <Grid
      container
      className={classnames(('popcorn-element icon-element'), `popcorn-${item.type}-element`)}
      onClick={onSelect}
      ref={ref}
      title={item.title || item.htmlText || item.type}
      tabIndex={-1}
      {...rest}
    >
      {icon && (
        <div className={classnames('inner-wrapper', `popcorn-${item.type}`)}>
          <SVGInline
            className="icon-btn"
            classSuffix="--inline"
            svg={icon}
            cleanup={['title']}
          />
        </div>
      )}
      <div className="popcorn-element__title">{ POPCORN_ELEMENT_LABELS[item.type]}</div>

      <div className={classnames('inner-wrapper', `popcorn-${item.type}-end`)}>
        { defaultIcon
        && item[DEFAULT_FIELD[item.type]] === DEFAULT_SETTINGS[item.type][DEFAULT_FIELD[item.type]]
          ? (
            <SVGInline
              className="icon-btn"
              classSuffix="--inline"
              svg={defaultIcon}
              cleanup={['title']}
            />
          ) : item[DEFAULT_FIELD[item.type]]}
      </div>
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
