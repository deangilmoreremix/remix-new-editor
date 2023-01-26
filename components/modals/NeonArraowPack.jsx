import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const NeonArraowPack = ({ handleClose,className,activeTab ,onSelect, query, onClick}) => {
  const { getNeonArrowPack } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getNeonArrowPack}
      title="Neon Arrow Pack"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
      onClick={onClick}
    />
  );
};

NeonArraowPack.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default NeonArraowPack;
