import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const LocationTitles = ({ handleClose,className,activeTab ,onSelect, query, onClick}) => {
  const { getLocationTitles } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getLocationTitles}
      title="Location Titles"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
      onClick={onClick}
    />
  );
};

LocationTitles.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default LocationTitles;
