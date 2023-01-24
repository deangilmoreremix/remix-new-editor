import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindow from './ViewProjectWindow';
import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';


const Presets = ({ handleClose,className,query }) => {
  const { getPresets, evolutionPresets } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getPresets}
      fetchItemsEvolution={evolutionPresets}
      title="lower thirds presets"
      className={className}
      query={query}
    />
  );
};

Presets.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default Presets;
