import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindow from './ViewProjectWindow/indexImageLT';

const Connect = ({ handleClose }) => {
  const { getConnect } = useMakeStore();

  return (
    <ViewProjectWindow
      handleClose={handleClose}
      fetchItems={getConnect}
      title="connect form"
      instantStart
    />
  );
};

Presets.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default Presets;
