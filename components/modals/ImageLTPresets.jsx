import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindow from './ViewProjectWindow';

const ImagePresets = ({ handleClose }) => {
  const { getImageLTPreset } = useMakeStore();

  return (
    <ViewProjectWindow
      handleClose={handleClose}
      fetchItems={getImageLTPreset}
      title="Image LT Preset"
    />
  );
};

ImagePresets.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default ImagePresets;
