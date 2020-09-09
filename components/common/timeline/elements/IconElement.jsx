import React, { useMemo } from 'react';
import classnames from 'classnames';
import Grid from '@material-ui/core/Grid/Grid';
import SVGInline from 'react-svg-inline';

import { POPCORN_ELEMENT_LABELS, POPCORN_ELEMENT_TYPES } from '../../../../lib/constants/popcorn';
import { DEFAULT_SETTINGS } from '../../../../lib/constants/settings';
import PropTypes from '../../../../lib/PropTypes';
import {
  TIMELINE_ELEMENT_DEFAULT_FIELD as DEFAULT_FIELD,
  TIMELINE_ELEMENT_DEFAULT_ICONS,
  TIMELINE_ELEMENT_ICONS,
} from '../../../../lib/constants/timeline';

const IconElement = React.forwardRef(({ item, ...rest }, ref) => {
  const icon = useMemo(() => TIMELINE_ELEMENT_ICONS[item.type], [item]);
  const quantityIcon = useMemo(() => TIMELINE_ELEMENT_DEFAULT_ICONS[item.type], [item]);

  const itemTitle = useMemo(() => {
    if (item.type === POPCORN_ELEMENT_TYPES.SOCIAL) {
      return item.title;
    }
    return POPCORN_ELEMENT_LABELS[item.type];
  }, [item.type, item.title]);

  return (
    <Grid
      container
      className={classnames('popcorn-element', 'icon-element', `popcorn-${item.type}-element`)}
      ref={ref}
      title={item.title || item.htmlText || item.type}
      tabIndex={-1}
      {...rest}
    >
      {icon && (
        <div className={classnames('inner-wrapper', 'popcorn-timeline-icon')}>
          <SVGInline
            className="icon-btn"
            classSuffix="--inline"
            svg={icon}
            cleanup={['title']}
          />
        </div>
      )}
      <div className="popcorn-element-title">
        {itemTitle}
      </div>
      <div className={classnames('inner-wrapper', 'popcorn-timeline-icon')}>
        {
          quantityIcon
          && item[DEFAULT_FIELD[item.type]]
          === DEFAULT_SETTINGS[item.type][DEFAULT_FIELD[item.type]]
            ? (
              <SVGInline
                className="icon-btn"
                classSuffix="--inline"
                svg={quantityIcon}
                cleanup={['title']}
              />
            ) : item[DEFAULT_FIELD[item.type]]
        }
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
};

export default IconElement;
