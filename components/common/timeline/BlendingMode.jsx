import React from 'react';

import useProjectStore from '../../hooks/useProjectStore';
import { BLEND_MODE } from '../../../lib/constants/popcorn';

import PropTypes from '../../../lib/PropTypes';

import blendModeConstants from '../../../lib/constants/blendMode';

import Menu from '../Menu';

const BlendingMode = ({ layer }) => {
  const { setLayerStyle } = useProjectStore();

  const onChange = value => {
    setLayerStyle(layer.id, {
      name: BLEND_MODE,
      value,
    });
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
