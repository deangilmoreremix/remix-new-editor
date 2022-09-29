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
    upgradeLink
  } = item;

  const [, dragRef] = useDrag({
    item: { type: label, action },
  });
  const imageClick = () => {
    window.open(upgradeLink, '_ blank')
  }
  return (
    <div className='element-container'>
    <button
      ref={acceptedDraggableItems.includes(label) ? dragRef : null}
      className="elements-panel-button"
      onClick={disabled ? imageClick :   () => onClick(action)}
      type="button"
    >
      <SVGInline
        className="elements-panel-icon"
        classSuffix="-inline"
        svg={icon}
        cleanup={['title']}
      />
      <span className="elements-panel-label">{label}</span>
      {disabled &&  <img className='pro-icon' src='/static/images/pro.png'/> }
    </button>
    </div>
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
