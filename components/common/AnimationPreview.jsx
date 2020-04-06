import React, { useState } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const AnimationPreview = ({ bg, title, onSelect }) => {
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
      <p className={classnames('animated', 'animation-preview__text', { [title]: isActive })}>
        {title}
      </p>
      {bg && (
        <SVGInline
          className="animation-preview__bg"
          svg={bg}
        />
      )}
      <button
        type="button"
        className="animation-preview__add"
        onClick={() => onSelect(title)}
      />
    </div>
  );
};

AnimationPreview.propTypes = {
  bg: PropTypes.string,
  title: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default AnimationPreview;
