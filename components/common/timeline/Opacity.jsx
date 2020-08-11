import React, { useState } from 'react';

import { ENTER_KEY, ARROW_UP, ARROW_DOWN } from '../../../lib/constants/keyCodes';
import { OPACITY } from '../../../lib/constants/popcorn';
import { WARNING_OPACITY } from '../../../lib/constants/text-info';

import useProjectStore from '../../hooks/useProjectStore';

import PropTypes from '../../../lib/PropTypes';

const step = 1;
const maxValue = 100;
const minValue = 1;

const Opacity = ({ layer }) => {
  const [count, setCount] = useState(layer.opacity ?? maxValue);
  const { setLayerStyle, showWarning } = useProjectStore();

  const handlePressKey = event => {
    if (event.keyCode === ENTER_KEY) {
      setLayerStyle(layer.id, {
        name: OPACITY,
        value: count >= minValue ? count : minValue,
      });
      showWarning(WARNING_OPACITY.title);
    }

    if (event.keyCode === ARROW_UP && Number(count) < maxValue) {
      if (count < minValue) {
        setCount(minValue);
      } else {
        setCount(Number(count) + step);
      }
    }

    if (event.keyCode === ARROW_DOWN && Number(count) > minValue) {
      setCount(Number(count) - step);
    }
  };

  const handleChange = event => {
    let value = event.target.value.replace(/\D/, '');
    if (value.length >= 2 && Number(value[0]) === 0) {
      value = Number(value.slice(1));
    }
    if (value > maxValue) {
      value = maxValue;
    }
    if (value < minValue) {
      value = minValue;
    }
    setCount(value);
  };

  return (
    <button className="opacity">
      <input
        type="text"
        value={count}
        onChange={handleChange}
        onKeyUp={handlePressKey}
        className="opacity-input"
      />
    </button>
  );
};

Opacity.propTypes = {
  layer: PropTypes.shape({
    id: PropTypes.string.isRequired,
    opacity: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]),
  }).isRequired,
};

export default Opacity;
