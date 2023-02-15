import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const YouTubeInterActive = ({ handleClose,className,activeTab ,onSelect, query}) => {
  const { getYouTubeInterActive } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getYouTubeInterActive}
      title="YouTube Interactive"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
    />
  );
};

YouTubeInterActive.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default YouTubeInterActive;
