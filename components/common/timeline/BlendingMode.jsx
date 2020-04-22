import React, { useState } from 'react';

import useProjectStore from '../../hooks/useProjectStore';

import PropTypes from '../../../lib/PropTypes';
import fixBlendModes from '../../../lib/constants/blendMode';

import Menu from '../Menu';

const BlendingMode = ({ id }) => {
  const [value, setValue] = useState(fixBlendModes[0]);
  const { setBlendMode } = useProjectStore();

  const onChange = (mode) => {
    fixBlendModes.forEach(item => {
      if (item.value === mode) {
        setValue(item);
      }
    });
    setBlendMode(id, mode);
  };

  return (
    <Menu
      toggleElement={value.title}
      items={fixBlendModes}
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
