import React, { useState } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const AnimationPreview = ({ animation, onSelect }) => {
  const [isActive, setIsActive] = useState(false);

  const onHover = () => {
    setIsActive(!isActive);
  };

  return (
    <div
      className="animation-preview"
      onMouseEnter={onHover}
      onMouseLeave={onHover}
    >
      <p className={classnames('animated', 'animation-preview__text', { [animation.value]: isActive })}>
        {animation.name}
      </p>
      {animation.background && (
        <SVGInline
          className="animation-preview__bg"
          svg={animation.background}
        />
      )}
      <button
        type="button"
        className="animation-preview__add"
        onClick={() => onSelect(animation.value)}
      />
    </div>
  );
};

AnimationPreview.propTypes = {
  animation: PropTypes.shape({
    name: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    background: PropTypes.string.isRequired,
  }).isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default AnimationPreview;
