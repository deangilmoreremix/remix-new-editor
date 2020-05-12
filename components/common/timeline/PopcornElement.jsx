import React, { useEffect, useRef } from 'react';
import { observer } from 'mobx-react';

import useProjectStore from '../../hooks/useProjectStore';
import useUiStore from '../../hooks/useUIStore';

import PropTypes from '../../../lib/PropTypes';
import { addDeleteListener, removeDeleteListener } from '../../../lib/mitt/emitter';

import { POPCORN_ELEMENT_TYPES } from '../../../lib/constants/popcorn';
import { TIMELINE_COMPONENTS } from '../../../lib/constants/timeline';
import DefaultElement from './elements/DefaultElement';

const PopcornElement = observer(({ item }) => {
  const projectStore = useProjectStore();
  const uiStore = useUiStore();
  const gridElementRef = useRef();

  const { editElement, releaseElement } = projectStore;

  let rest = {};

  const selectItem = () => {
    addDeleteListener(gridElementRef.current, item.i);
  };

  useEffect(() => () => removeDeleteListener(gridElementRef.current, item.i), [item.i]);

  rest = {
    onClick: () => {
      if (Object.values(POPCORN_ELEMENT_TYPES).includes(item.type)) {
        addDeleteListener(gridElementRef.current, item.i);
        editElement(item.i);
        uiStore.openSettings();
      } else {
        addDeleteListener(gridElementRef.current, item.i);
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
      onSelect={selectItem}
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
