import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const SocialMediaIcon3D = ({ handleClose,className,activeTab ,onSelect, query, onClick}) => {
  const { getSocialMediaIcon3D } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getSocialMediaIcon3D}
      title="Social Media Icon 3D"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
      onClick={onClick}
    />
  );
};

SocialMediaIcon3D.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default SocialMediaIcon3D;
