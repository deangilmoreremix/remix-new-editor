import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindow from './ViewProjectWindow';

const Presets = ({ handleClose }) => {
  const { getConnect } = useMakeStore();

  return (
    <ViewProjectWindow
      handleClose={handleClose}
      fetchItems={getConnect}
      title="connect form"
    />
  );
};

Presets.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default Presets;
