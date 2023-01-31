import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const NeonSocialMediaLT = ({ handleClose,className,activeTab ,onSelect, query}) => {
  const { getNeonSocialMediaLT } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getNeonSocialMediaLT}
      title="Neon Social Media LT"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
    />
  );
};

NeonSocialMediaLT.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default NeonSocialMediaLT;
