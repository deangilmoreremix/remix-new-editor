import * as React from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import { animated, useTransition } from 'react-spring';

import { emitter, emitterActions } from '../../../lib/mitt/emitter';
import PropTypes from '../../../lib/PropTypes';
import svgTransitionFrom from '../../../public/static/svgImages/transitions/icon-transition-from.svg';
import svgTransitionTo from '../../../public/static/svgImages/transitions/icon-transition-to.svg';
import { FROM, OFF, ON, TO } from '../../../lib/constants/popcorn';

const TransitionButton = ({ type, onClick, className, from, to }) => {
  const [hovered, setHovered] = React.useState(false);
  const buttonElement = React.useRef(null);

  const isFrom = React.useMemo(() => type === FROM, [type]);
  const isTo = React.useMemo(() => type === TO, [type]);

  const transitions = useTransition(true, null, {
    from: { transform: `translate(${isFrom ? '-100%' : '100%'}, -50%) scale(0)`, opacity: 0 },
    enter: { transform: 'translate(0, -50%) scale(1)', opacity: 1 },
    leave: { transform: `translate(${isFrom ? '-100%' : '100%'}, -50%) scale(0)`, opacity: 0 },
  });

  const handlePairHovered = ({ event, type: buttonType, from: fromId, to: toId }) => {
    if (buttonType !== type && (
      (isFrom && fromId === from) || (isTo && toId === to))
    ) {
      if (event === ON && !hovered) {
        setHovered(true);
      } else if (event === OFF) {
        setHovered(false);
      }
    }
  };

  React.useEffect(() => {
    emitter.on(emitterActions.HOVER, handlePairHovered);
    return () => emitter.off(emitterActions.HOVER, handlePairHovered);
  }, []);

  const icon = React.useMemo(() => {
    if (type === FROM) {
      return svgTransitionFrom;
    }
    if (type === TO) {
      return svgTransitionTo;
    }
    return '';
  }, [type]);

  const handleMouseOver = () => {
    setHovered(true);
    emitter.emit(emitterActions.HOVER, { event: ON, type, from, to });
  };

  const handleMouseLeave = () => {
    setHovered(false);
    emitter.emit(emitterActions.HOVER, { event: OFF, type, from, to });
  };

  return transitions.map(({ item, key, props }) => item && (
    <animated.button
      key={key}
      style={props}
      ref={buttonElement}
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
      onFocus={() => {}}
      className={classnames('add-transition-btn', className, type, { hovered })}
      title="Animate transition"
      type="button"
      onClick={onClick}
    >
      {icon && (
        <SVGInline
          className="add-transition-btn-icon"
          classSuffix="--inline"
          svg={icon}
          cleanup={['title']}
        />
      )}
    </animated.button>
  ));
};

TransitionButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  type: PropTypes.string.isRequired,
  className: PropTypes.string,
  from: PropTypes.string,
  to: PropTypes.string,
};

export default TransitionButton;
