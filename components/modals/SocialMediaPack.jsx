import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const SocialMediaPack = ({ handleClose,className,activeTab ,onSelect, query, onClick}) => {
  const { getSocialMediaPack } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getSocialMediaPack}
      title="Social Media Pack"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
      onClick={onClick}
    />
  );
};

SocialMediaPack.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default SocialMediaPack;
