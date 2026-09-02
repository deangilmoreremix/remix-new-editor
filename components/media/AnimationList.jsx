import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import classnames from 'classnames';
import PropTypes from '../../lib/PropTypes';
import { animations, ANIMATION_TYPES, ANIMATION_GROUPS } from '../../lib/constants/animations';
import { editorStyles } from '../../lib/constants/editorStyles';

import useUIStore from '../hooks/useUIStore';
import useTimelineStore from '../hooks/useTimelineStore';

import AnimationPreview from '../common/AnimationPreview';
import CloseButton from '../common/CloseButton';

const AnimationList = observer(({ onSelect, element }) => {
  const { closeAnimationLibrary } = useUIStore();
  const { timelineHeight } = useTimelineStore();

  const animationGroups = React.useMemo(() => ANIMATION_GROUPS[element.type]
    || Object.values(ANIMATION_TYPES), [element]);

  const selected = element.popcornOptions.animation ? {
    [ANIMATION_TYPES.IN]: element.popcornOptions.animation.in
    && element.popcornOptions.animation.in.type,
    [ANIMATION_TYPES.IDLE]: element.popcornOptions.animation.idle
    && element.popcornOptions.animation.idle.type,
    [ANIMATION_TYPES.OUT]: element.popcornOptions.animation.out
    && element.popcornOptions.animation.out.type,
  } : {};

  const block = React.useCallback((type) => (
    <div key={type} className="animation-block">
      {
          animations[type].map(item => (
            <AnimationPreview
              animation={item}
              onSelect={() => onSelect(item.value, type)}
              key={item.value}
              className={classnames(type, { selected: item.value === selected[type] })}
            />
          ),
          )
        }
    </div>
  ), [onSelect, selected]);

  const libraryHeight = useMemo(() => (
    editorStyles.calculateHeight(timelineHeight)
  ), [timelineHeight]);

  return (
    <div style={{ height: libraryHeight }} className="animation-container">
      <p className="animation-container__title">Add Animation</p>
      <div className="animation-blocks">
        {animationGroups.map((type => block(type)))}
      </div>
      <CloseButton className="close-button-extend" onClick={closeAnimationLibrary} />
    </div>
  );
},
);

AnimationList.propTypes = {
  onSelect: PropTypes.func.isRequired,
  element: PropTypes.shape({
    type: PropTypes.string.isRequired,
  }).isRequired,
};

export default AnimationList;
