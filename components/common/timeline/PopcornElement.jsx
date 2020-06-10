import React, { useEffect, useRef } from 'react';
import { observer } from 'mobx-react';

import useProjectStore from '../../hooks/useProjectStore';
import PropTypes from '../../../lib/PropTypes';
import { addDeleteListener, removeDeleteListener, selectItem } from '../../../lib/mitt/emitter';

import { POPCORN_ELEMENT_TYPES } from '../../../lib/constants/popcorn';
import { TIMELINE_COMPONENTS } from '../../../lib/constants/timeline';
import DefaultElement from './elements/DefaultElement';

const PopcornElement = observer(({ item }) => {
  const projectStore = useProjectStore();
  const gridElementRef = useRef();

  const { releaseElement } = projectStore;

  let rest = {};

  useEffect(() => {
    removeDeleteListener(gridElementRef.current, item.i);
    addDeleteListener(gridElementRef.current, item.i);
    return () => removeDeleteListener(gridElementRef.current, item.i);
  }, [item.i]);

  rest = {
    onClick: (e) => {
      if (Object.values(POPCORN_ELEMENT_TYPES).includes(item.type)) {
        selectItem(e, item.i);
      } else {
        releaseElement();
      }
    },
  };

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
      ref={gridElementRef}
      tabIndex={-1}
      {...rest}
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
