import React from 'react';
import { animated, useTransition } from 'react-spring';

const AnimatedWindow = ({ children, isOpen, style }) => {
  const transitions = useTransition(isOpen, null, {
    from: { transform: 'translateX(-100%)', opacity: '0' },
    enter: { transform: 'translateX(0%)', opacity: '1' },
    leave: { display: 'none' },
  });

  return transitions.map(({ item, key, props }) => (
    item && (
    <animated.div
      key={key}
      style={{ ...props, position: 'relative', width: '100%', height: '100%', ...style }}
    >
      {children}
    </animated.div>
    )
  ));
};

export default AnimatedWindow;
