import React from 'react';
import { observer } from 'mobx-react';
import Grid from '@material-ui/core/Grid/Grid';

import useUIStore from '../../hooks/useUIStore';
import useProjectStore from '../../hooks/useProjectStore';

import PropTypes from '../../../lib/PropTypes';

import { POPCORN_ELEMENT_TYPES } from '../../../lib/constants/popcorn';
import { NONE_CLASS, ANIMATION_TYPES } from '../../../lib/constants/animations';

const getGridItem = (animationType, item, updateAnimation) => {
  switch (item.type) {
    case POPCORN_ELEMENT_TYPES.TEXT: {
      const animated = item.animation && item.animation[animationType]
        && item.animation[animationType].type !== NONE_CLASS;
      return (
        <Grid
          xs={4}
          item
          className={`popcorn-element-part ${animated ? `${animationType}-animation-element` : ''}`}
        >
          {animated
          && (
          <button className="icon-button" onClick={() => updateAnimation(animationType, NONE_CLASS)}>
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

const PopcornElement = observer(({ item }) => {
  const projectStore = useProjectStore();
  const uiStore = useUIStore();

  const { editElement, updateAnimation } = projectStore;
  const { openAnimation } = uiStore;

  let rest = {};

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
      {getGridItem(ANIMATION_TYPES.IN, item, updateAnimation)}
      {getGridItem(ANIMATION_TYPES.IDLE, item, updateAnimation)}
      {getGridItem(ANIMATION_TYPES.OUT, item, updateAnimation)}
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
