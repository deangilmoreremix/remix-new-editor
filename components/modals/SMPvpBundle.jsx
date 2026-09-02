import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const SMPvpBundle = ({ handleClose,className,activeTab ,onSelect, query}) => {
  const { getSMPvpBundle } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getSMPvpBundle}
      title="SM PVP Bundle"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
    />
  );
};

SMPvpBundle.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default SMPvpBundle;
