import React from 'react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';
import { animations, animationsBg } from '../../lib/constants/animations';

import HideWindow from '../common/HideWindow';

const Animation = ({ type }) => {
  const onHover = (e, className, action) => {
    const text = e.target.getElementsByClassName('animation__title')[0];
    if (action && text) {
      text.classList.add(className);
    }

    if (text) {
      text.addEventListener('animationend', removeClass);
    }

    function removeClass() {
      text.classList.remove(className);
      text.removeEventListener('animationend', removeClass);
    }
  };

  return (
    <div className="animation-container">
      <p className="animation-container__title">Add Animation</p>
      <div className="animation-blocks">
        {
          animations[type].types.map((item, i) => {
            const bgIndex = animationsBg.length - (i % animationsBg.length) - 1;

            return (
              <div className="animation-block" key={item}>
                <p
                  className="animation__text"
                  onMouseEnter={e => onHover(e, item, true)}
                >
                  <span className="animated animation__title">{item}</span>
                </p>
                <SVGInline
                  className="animation__bg"
                  svg={animationsBg[bgIndex]}
                />
              </div>
            );
          })
        }
      </div>
      <HideWindow onClick={() => console.log('click')} />
    </div>
  );
};

Animation.propTypes = {
  type: PropTypes.string.isRequired,
};

export default Animation;
