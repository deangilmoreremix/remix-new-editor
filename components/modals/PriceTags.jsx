import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const PriceTags = ({ handleClose,className,activeTab ,onSelect, query}) => {
  const { getPriceTags } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getPriceTags}
      title="Price Tags"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
    />
  );
};

PriceTags.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default PriceTags;
