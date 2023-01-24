import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const EndScreens = ({ handleClose, className, query }) => {
  const { getEndScreens } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getEndScreens}
      className={className}
      title="End Screens"
      query={query}
    />
  );
};

EndScreens.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default EndScreens;
