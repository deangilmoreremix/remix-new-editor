import React from 'react';

import useProjectStore from '../../hooks/useProjectStore';

import PropTypes from '../../../lib/PropTypes';

import blendModeConstants from '../../../lib/constants/blendMode';

import Menu from '../Menu';

const BlendingMode = ({ layer }) => {
  const { setBlendMode } = useProjectStore();

  const onChange = value => {
    setBlendMode(layer.id, value);
  };

  return (
    <Menu
      toggleElement={(layer.blendMode && blendModeConstants[layer.blendMode].title)
      || blendModeConstants.normal.title}
      items={Object.values(blendModeConstants)}
      useButton
      className="blend-mode-select"
      onClick={onChange}
    />
  );
};

BlendingMode.propTypes = {
  layer: PropTypes.shape({
    id: PropTypes.string.isRequired,
    blendMode: PropTypes.string,
  }).isRequired,
};

export default BlendingMode;
