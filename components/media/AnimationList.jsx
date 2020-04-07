import React from 'react';

import PropTypes from '../../lib/PropTypes';
import { animations } from '../../lib/constants/animations';

import AnimationPreview from '../common/AnimationPreview';
import CloseButton from '../common/CloseButton';

const AnimationList = ({ type, onSelect }) => (
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

AnimationList.propTypes = {
  type: PropTypes.oneOf(['in', 'out', 'idle']).isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default AnimationList;
