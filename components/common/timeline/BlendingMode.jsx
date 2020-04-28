import React from 'react';

import useProjectStore from '../../hooks/useProjectStore';

import PropTypes from '../../../lib/PropTypes';
import fixBlendModes from '../../../lib/constants/blendMode';

import Menu from '../Menu';

const BlendingMode = ({ item }) => {
  const { setBlendMode } = useProjectStore();

  const onChange = title => {
    Object.keys(fixBlendModes).forEach(key => {
      if (fixBlendModes[key].title === title) {
        setBlendMode(item.id, key);
      }
    });
  };

  return (
    <Menu
      toggleElement={item.blendMode ? item.blendMode : Object.values(fixBlendModes)[0].title}
      items={Object.values(fixBlendModes)}
      useButton
      className="blend-mode-select"
      onClick={onChange}
    />
  );
};

BlendingMode.propTypes = {
  item: PropTypes.shape().isRequired,
};

export default BlendingMode;
