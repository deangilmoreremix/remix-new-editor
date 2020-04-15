import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';
import { animations, ANIMATION_TYPES } from '../../lib/constants/animations';

import AnimationPreview from '../common/AnimationPreview';
import CloseButton from '../common/CloseButton';

const AnimationList = observer(({ onSelect }) => {
  const block = React.useCallback((type) => (
    <div key={type} className="animation-block">
      {
          animations[type].map(item => (
            <AnimationPreview
              animation={item}
              onSelect={() => onSelect(item.value, type)}
              key={item.value}
              className={type}
            />
          ),
          )
        }
    </div>
  ), [onSelect]);

  return (
    <div className="animation-container">
      <p className="animation-container__title">Add Animation</p>
      <div className="animation-blocks">
        { Object.values(ANIMATION_TYPES).map((type => block(type)))}
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
