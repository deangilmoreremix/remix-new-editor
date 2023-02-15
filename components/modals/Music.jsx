import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const Music = ({ handleClose, className, query }) => {
  const { getMusic } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getMusic}
      className={className}
      title="End Screens"
      query={query}
    />
  );
};

Music.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default Music;
