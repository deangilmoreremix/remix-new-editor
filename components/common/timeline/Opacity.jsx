import React, { useState } from 'react';

import useProjectStore from '../../hooks/useProjectStore';

import PropTypes from '../../../lib/PropTypes';

const Opacity = ({ layer }) => {
  const [count, setCount] = useState(0);

  const { setOpacity } = useProjectStore();

  const onChange = event => {
    let { value } = event.target;
    if (parseFloat(value) > 100) {
      setCount(100);
      return setOpacity(layer.id, 100);
    }

    value = value
      .replace(/^.*?((\d+\.?|\.)\d{0,2}).*|.+/, '$1')
      .replace(/^0*(?!\.|$)/, '')
      .replace(/^\.$|^(\.)/, '0$1');

    setCount(value);
    setOpacity(layer.id, parseFloat(value));
  };

  return (
    <button className="opacity">
      <input
        type="text"
        value={count}
        onChange={onChange}
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
