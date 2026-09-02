import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const NeonLT = ({ handleClose,className,activeTab ,onSelect, query}) => {
  const { getNeonLT } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getNeonLT}
      title="Neon LT"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
    />
  );
};

NeonLT.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default NeonLT;
