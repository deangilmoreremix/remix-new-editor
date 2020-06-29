import React, { useState } from 'react';

import { ENTER_KEY, ARROW_UP, ARROW_DOWN } from '../../../lib/constants/keyCodes';

import useProjectStore from '../../hooks/useProjectStore';

import PropTypes from '../../../lib/PropTypes';

const Opacity = ({ layer }) => {
  const [count, setCount] = useState(layer.opacity ?? 100);
  const { setOpacity } = useProjectStore();
  const step = 1;

  const handlePressKey = event => {
    if (event.keyCode === ENTER_KEY) {
      setOpacity(layer.id, count);
    }

    if (event.keyCode === ARROW_UP && count < 100) {
      setCount(count + step);
    }

    if (event.keyCode === ARROW_DOWN && count > 0) {
      setCount(count - step);
    }
  };

  const handleChange = event => {
    let value = event.target.value.replace(/\D/, '');
    if (value.length >= 2 && Number(value[0]) === 0) {
      value = Number(value.slice(1));
    }
    if (value > 100) {
      value = 100;
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
