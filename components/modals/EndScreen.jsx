import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const EndScreens = ({ handleClose }) => {
  const { getEndScreens } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getEndScreens}
      title="End Screens"
    />
  );
};

EndScreens.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default EndScreens;
