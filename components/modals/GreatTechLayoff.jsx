import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const GreatTechLayoff = ({ handleClose,className,activeTab ,onSelect, query}) => {
  const { getGreatTechLayoff } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getGreatTechLayoff}
      title="Great Tech Layoff"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
    />
  );
};

GreatTechLayoff.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default GreatTechLayoff;
