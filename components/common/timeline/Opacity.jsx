import React, { useState } from 'react';

import useProjectStore from '../../hooks/useProjectStore';

import PropTypes from '../../../lib/PropTypes';

const Opacity = ({ layer }) => {
  const [count, setCount] = useState(layer.opacity ?? 100);
  const { setOpacity } = useProjectStore();

  const handlePressKey = event => {
    if (event.key === 'Enter') {
      setOpacity(layer.id, count);
    }

    if (event.key === 'ArrowUp' && count < 100) {
      setCount(count + 1);
    }

    if (event.key === 'ArrowDown' && count > 0) {
      setCount(count - 1);
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
