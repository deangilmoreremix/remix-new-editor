import React, { useState } from 'react';

import useProjectStore from '../../hooks/useProjectStore';

import PropTypes from '../../../lib/PropTypes';

const Opacity = ({ layer }) => {
  const [count, setCount] = useState(layer.opacity ?? 100);
  const { setOpacity } = useProjectStore();

  const saveChanges = event => {
    if (event.key === 'Enter') {
      setOpacity(layer.id, count);
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
        onKeyUp={saveChanges}
        className="opacity-input"
      />
    </button>
  );
};

Opacity.propTypes = {
  layer: PropTypes.shape({
    id: PropTypes.string.isRequired,
    opacity: PropTypes.number,
  }).isRequired,
};

export default Opacity;
