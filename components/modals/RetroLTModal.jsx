import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const RetroLT = ({ handleClose,className,activeTab ,onSelect, query}) => {
  const { getRetroLT } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getRetroLT}
      title="Retro LT"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
    />
  );
};

RetroLT.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default RetroLT;