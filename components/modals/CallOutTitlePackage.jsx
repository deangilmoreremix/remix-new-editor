import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const CallOutTitlePackage = ({ handleClose,className,activeTab ,onSelect, query, onClick}) => {
  const { getCallOutTitlePackage } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getCallOutTitlePackage}
      title="Call Out Title Package"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
      onClick={onClick}
    />
  );
};

CallOutTitlePackage.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default CallOutTitlePackage;
