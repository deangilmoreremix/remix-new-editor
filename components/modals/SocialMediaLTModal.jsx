import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const SocialMediaLT = ({ handleClose,className,activeTab ,onSelect, query}) => {
  const { getSocialMediaLT } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getSocialMediaLT}
      title="Social Media LT"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
    />
  );
};

SocialMediaLT.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default SocialMediaLT;