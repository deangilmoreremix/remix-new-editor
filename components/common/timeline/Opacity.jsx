import React, { useState } from 'react';

import useProjectStore from '../../hooks/useProjectStore';

import PropTypes from '../../../lib/PropTypes';

const Opacity = ({ layer }) => {
  const [count, setCount] = useState();

  const { setOpacity } = useProjectStore();

  const onChange = e => {
    // console.log(".", e.key);
    // const value = e.target.value.replace(/\D/, '');
    // setCount(e.target.value);
    // setOpacity(layer.id, value);
  };

  const onKeyDown = (e) => {
    // const value = e.target.value;
    console.log(e.target.value);
    setCount(e.target.value);
    // return null;
  };

  return (
    <button className="opacity">
      <input
        type="text"
        value={count}
        onChange={onChange}
        onKeyUp={onKeyDown}
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
