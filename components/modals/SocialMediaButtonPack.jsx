import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const SocialMediaButtonPack = ({ handleClose,className,activeTab ,onSelect, query, onClick}) => {
  const { getSocialMediaButtonPack } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getSocialMediaButtonPack}
      title="Social Media Button Pack"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
      onClick={onClick}
    />
  );
};

SocialMediaButtonPack.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default SocialMediaButtonPack;
