import React, { useState } from 'react';

import useProjectStore from '../../hooks/useProjectStore';

import PropTypes from '../../../lib/PropTypes';
import blendMode from '../../../lib/constants/blendMode';

import Menu from '../Menu';

const BlendingMode = ({ id }) => {
  const [value, setValue] = useState(blendMode[0]);
  const { setBlendMode } = useProjectStore();

  const onChange = (mode) => {
    blendMode.forEach(item => {
      if (item.value === mode) {
        setValue(item);
      }
    });
    setBlendMode(id, mode);
  };

  return (
    <Menu
      toggleElement={value.title}
      items={blendMode}
      simpleBtn
      className="blend-mode-select"
      onClick={onChange}
    />
  );
};

BlendingMode.propTypes = {
  id: PropTypes.string.isRequired,
};

export default BlendingMode;
