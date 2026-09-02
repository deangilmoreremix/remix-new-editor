import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const ImagePresets = ({ handleClose,className,activeTab ,onSelect, query}) => {
  const { getImageLTPreset } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getImageLTPreset}
      title="Image LT Preset"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
    />
  );
};

ImagePresets.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default ImagePresets;
