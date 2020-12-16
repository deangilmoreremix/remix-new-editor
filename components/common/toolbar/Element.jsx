import React from 'react';
import SVGInline from 'react-svg-inline';
import { useDrag } from 'react-dnd';

import PropTypes from '../../../lib/PropTypes';
import { acceptedDraggableItems } from '../../../lib/constants/dragNDropConstants';

const Element = (props) => {
  const {
    item,
    onClick,
  } = props;

  const {
    label,
    icon,
    action,
    disabled,
  } = item;

  const [, dragRef] = useDrag({
    item: { type: label, action },
  });

  return (
    <button
      ref={acceptedDraggableItems.includes(label) ? dragRef : null}
      className="elements-panel-button"
      disabled={disabled}
      onClick={() => onClick(action)}
      type="button"
    >
      <SVGInline
        className="elements-panel-icon"
        classSuffix="-inline"
        svg={icon}
        cleanup={['title']}
      />
      <span className="elements-panel-label">{label}</span>
    </button>
  );
};

Element.propTypes = {
  item: PropTypes.shape({
    label: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
    action: PropTypes.func.isRequired,
    disabled: PropTypes.boolean,
  }).isRequired,
  onClick: PropTypes.func.isRequired,
};

export default Element;
