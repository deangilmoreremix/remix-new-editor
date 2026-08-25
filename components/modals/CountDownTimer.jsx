import React from 'react';

import PropTypes from '../../lib/PropTypes';

import useMakeStore from '../hooks/useMakeStore';

import ViewProjectWindowImageLt from './ViewProjectWindow/indexImageLT';

const CountDownTimer = ({ handleClose,className,activeTab ,onSelect, query}) => {
  const { getCountDownTimers } = useMakeStore();

  return (
    <ViewProjectWindowImageLt
      handleClose={handleClose}
      fetchItems={getCountDownTimers}
      title="Count Down Timer"
      className={className}
      activeTab={activeTab}
      onSelect={onSelect}
      query={query}
    />
  );
};

CountDownTimer.propTypes = {
  handleClose: PropTypes.func.isRequired,
};

export default CountDownTimer;
