import React, { useState } from 'react';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const AnimationPreview = ({ animation, onSelect, className }) => {
  const [isActive, setIsActive] = useState(false);

  const onHover = () => {
    setIsActive(!isActive);
  };

  return (
    <div
      className={classnames('animation-preview ', className)}
      onMouseEnter={onHover}
      onMouseLeave={onHover}
    >
      <p className={classnames('animated', 'animation-preview__text', { [animation.value]: isActive })}>
        {animation.name}
      </p>
      <button
        type="button"
        className="animation-preview__add"
        onClick={onSelect}
      />
    </div>
  );
};

AnimationPreview.propTypes = {
  animation: PropTypes.shape({
    name: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  }).isRequired,
  onSelect: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export default AnimationPreview;
