import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindow from './ViewProjectWindow/indexImageLT';

const Presets = ({ handleClose ,className, query}) => {
  const { getConnect } = useMakeStore();

  return (
    <ViewProjectWindow
      handleClose={handleClose}
      fetchItems={getConnect}
      title="connect form"
      className={className}
      instantStart
      query={query}
    />
  );
};

Presets.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default Presets;
