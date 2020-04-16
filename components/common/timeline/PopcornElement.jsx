import React from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';
import Grid from '@material-ui/core/Grid/Grid';

import useUIStore from '../../hooks/useUIStore';
import useProjectStore from '../../hooks/useProjectStore';

import PropTypes from '../../../lib/PropTypes';

import { POPCORN_ELEMENT_TYPES } from '../../../lib/constants/popcorn';
import { NONE_CLASS, ANIMATION_TYPES } from '../../../lib/constants/animations';

const PopcornElement = observer(({ item }) => {
  const projectStore = useProjectStore();
  const uiStore = useUIStore();

  const { editElement, updateAnimation } = projectStore;
  const { openAnimation } = uiStore;

  let rest = {};

  const getGridItem = (animationType) => {
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
      } default: {
        return (
          <Grid
            xs={4}
            item
          />
        );
      }
    }
  };


  if (item.type === POPCORN_ELEMENT_TYPES.TEXT) {
    rest = {
      onClick: () => {
        editElement(item.i);
        openAnimation();
      },
    };
  }

  return (
    <Grid
      container
      className="popcorn-element"
      {...rest}
    >
      <span className="popcorn-element-name">{item.type}</span>
      {getGridItem(ANIMATION_TYPES.IN)}
      {getGridItem(ANIMATION_TYPES.IDLE)}
      {getGridItem(ANIMATION_TYPES.OUT)}
    </Grid>
  );
});

PopcornElement.propTypes = {
  item: PropTypes.shape({
    animation: PropTypes.shape({}),
    i: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  }).isRequired,
};

export default PopcornElement;
