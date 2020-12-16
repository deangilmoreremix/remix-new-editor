import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';

import { TIMELINE_COMPONENTS } from '../../../lib/constants/timeline';
import DefaultElement from './elements/DefaultElement';

const PopcornElement = observer(({ item }) => {
  const Element = React.useMemo(() => {
    if (TIMELINE_COMPONENTS[item.type]) {
      return TIMELINE_COMPONENTS[item.type];
    }
    return DefaultElement;
  }, [item]);

  if (!Element) {
    return null;
  }

  return (
    <Element
      item={item}
      tabIndex={-1}
    />
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
