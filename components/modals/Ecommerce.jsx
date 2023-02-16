import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const Ecommerce = ({ handleClose,className,activeTab ,onSelect, query}) => {
  const { getEcommerce } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getEcommerce}
      title="Ecommerce"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
    />
  );
};

Ecommerce.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default Ecommerce;
