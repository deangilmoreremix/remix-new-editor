import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindow from './ViewProjectWindow';

const Presets = ({ handleClose }) => {
  const { getPresets, evolutionPresets } = useMakeStore();

  return (
    <ViewProjectWindow
      handleClose={handleClose}
      fetchItems={getPresets}
      fetchItemsEvolution={evolutionPresets}
      title="lower thirds presets"
    />
  );
};

Presets.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default Presets;
