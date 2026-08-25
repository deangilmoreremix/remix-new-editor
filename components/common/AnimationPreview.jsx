import React, { useState } from 'react';
import classnames from 'classnames';

import { WARNING_ANIMATION } from '../../lib/constants/text-info';

import useProjectStore from '../hooks/useProjectStore';

import PropTypes from '../../lib/PropTypes';

const AnimationPreview = ({ animation, onSelect, className }) => {
  const [isActive, setIsActive] = useState(false);
  const { showWarning } = useProjectStore();

  const onHover = () => {
    setIsActive(!isActive);
  };

  const handleClick = () => {
    showWarning(WARNING_ANIMATION.title);
    onSelect();
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
        onClick={handleClick}
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
