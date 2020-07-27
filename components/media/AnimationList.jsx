import React from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';
import { animations, ANIMATION_TYPES } from '../../lib/constants/animations';

import useUIStore from '../hooks/useUIStore';

import AnimationPreview from '../common/AnimationPreview';
import CloseButton from '../common/CloseButton';

const AnimationList = observer(({ onSelect }) => {
  const { toggleRightBlock, isTimelineOpen } = useUIStore();

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
    <div className={classnames('animation-container', { 'big-window': !isTimelineOpen })}>
      <p className="animation-container__title">Add Animation</p>
      <div className="animation-blocks">
        {Object.values(ANIMATION_TYPES).map((type => block(type)))}
      </div>
      <CloseButton onClick={() => toggleRightBlock(false)} />
    </div>
  );
},
);

AnimationList.propTypes = {
  onSelect: PropTypes.func.isRequired,
};

export default AnimationList;
