import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';
import { animations } from '../../lib/constants/animations';

import AnimationPreview from '../common/AnimationPreview';
import CloseButton from '../common/CloseButton';

import useUI from '../hooks/useUIStore';

const AnimationList = observer(({ onSelect }) => {
  const uiStore = useUI();
  const { animationType: type } = uiStore;

  return (
    <div className="animation-container">
      <p className="animation-container__title">Add Animation</p>
      <div className="animation-blocks">
        {
      animations[type].map(item => (
        <AnimationPreview
          animation={item}
          onSelect={onSelect}
          key={item.value}
        />
      ),
      )
    }
      </div>
      {/* ToDo Need to remove the close button */}
      <CloseButton onClick={() => console.log('click')} />
    </div>
  );
},
);

AnimationList.propTypes = {
  onSelect: PropTypes.func.isRequired,
};

export default AnimationList;
