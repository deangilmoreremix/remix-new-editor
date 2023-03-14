import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const MillionDollarHack = ({ handleClose,className,activeTab ,onSelect, query}) => {
  const { getMillionDollarHack } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getMillionDollarHack}
      title="YouTube Interactive"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
    />
  );
};

MillionDollarHack.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default MillionDollarHack;
