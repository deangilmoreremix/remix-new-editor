import React, { useState } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const AnimationPreview = ({ background, title, onSelect }) => {
  const [isActive, setIsActive] = useState(false);

  const animationClass = () => {
    let string = '';
    const array = title.split(' ');
    array.forEach((str, i) => {
      if (i === 0) {
        string += array[i][0].toLowerCase() + array[i].slice(1);
      } else {
        string += array[i][0].toUpperCase() + array[i].slice(1);
      }
    });
    return string;
  };

  const onHover = () => {
    setIsActive(!isActive);
  };

  return (
    <div
      className="animation-preview"
      onMouseEnter={onHover}
      onMouseLeave={onHover}
    >
      <p className={classnames('animated', 'animation-preview__text', { [animationClass()]: isActive })}>
        {title}
      </p>
      {background && (
        <SVGInline
          className="animation-preview__bg"
          svg={background}
        />
      )}
      <button
        type="button"
        className="animation-preview__add"
        onClick={() => onSelect(animationClass())}
      />
    </div>
  );
};

AnimationPreview.propTypes = {
  background: PropTypes.string,
  title: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default AnimationPreview;
