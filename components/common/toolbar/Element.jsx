import React from 'react';
import SVGInline from 'react-svg-inline';
import { useDrag } from 'react-dnd';
import useUserStore from '../../hooks/useUserStore';
import { FEATURES } from '../../../lib/constants/campaigns/constants';

import PropTypes from '../../../lib/PropTypes';
import { acceptedDraggableItems } from '../../../lib/constants/dragNDropConstants';

const Element = (props) => {
  const userStore = useUserStore();
  const {
    item,
    onClick,
  } = props;

  const {
    getUpgradeLinkRole,
  } = userStore;
  const {
    label,
    icon,
    action,
    disabled,
  } = item;

  const [, dragRef] = useDrag({
    item: { type: label, action },
  });

  const imageClick =  async () => {
    const featureDetails = FEATURES.find(ele => ele.label.trim() == item.label.trim());
    const tempUpgradeLink = await getUpgradeLinkRole(featureDetails.name,featureDetails.envName,featureDetails.revName);
    if(tempUpgradeLink) {
      await window.open(tempUpgradeLink, '_blank')
    }
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
