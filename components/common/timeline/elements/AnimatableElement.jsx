import * as React from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import Grid from '@material-ui/core/Grid/Grid';
import ContentEditable from 'react-contenteditable';

import { ANIMATION_TYPES, NONE_CLASS } from '../../../../lib/constants/animations';
import { POPCORN_ELEMENT_LABELS, POPCORN_ELEMENT_TYPES } from '../../../../lib/constants/popcorn';
import PropTypes from '../../../../lib/PropTypes';
import useProjectStore from '../../../hooks/useProjectStore';
import { wrapTokens } from '../../../../lib/utils/tokens-helper';

const AnimatableElement = React.forwardRef(({ onSelect, item, ...rest }, ref) => {
  const { updateAnimation } = useProjectStore();

  const getGridItem = React.useCallback((animationType) => {
    switch (item.type) {
      case POPCORN_ELEMENT_TYPES.TEXT: {
        const animated = item.animation && item.animation[animationType]
          && item.animation[animationType].type !== NONE_CLASS;
        return (
          <Grid
            xs={4}
            item
            className={classnames('popcorn-element-part',
              { [`${animationType}-animation-element`]: animated })}
          >
            {animated && (
              <button className="icon-button" onClick={() => updateAnimation(animationType)}>
                x
              </button>
            )}
          </Grid>
        );
      }
      default: {
        return null;
      }
    }
  }, [item]);

  return (
    <Grid
      title={item.title || item.htmlText || item.type}
      container
      className="popcorn-element"
      onClick={onSelect}
      ref={ref}
      tabIndex={-1}
      {...rest}
    >
      <span className="popcorn-element-name">
        {item.htmlText ? (
          <ContentEditable
            className="popcorn-element-text"
            tagName="span"
            html={wrapTokens(item.htmlText)}
            onChange={() => {}}
          />
        ) : POPCORN_ELEMENT_LABELS[item.type]}
      </span>
      {getGridItem(ANIMATION_TYPES.IN)}
      {getGridItem(ANIMATION_TYPES.IDLE)}
      {getGridItem(ANIMATION_TYPES.OUT)}
    </Grid>
  );
});

AnimatableElement.propTypes = {
  item: PropTypes.shape({
    type: PropTypes.string.isRequired,
    animation: PropTypes.shape({}),
    i: PropTypes.string.isRequired,
    title: PropTypes.string,
    htmlText: PropTypes.string,
  }).isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default observer(AnimatableElement);
