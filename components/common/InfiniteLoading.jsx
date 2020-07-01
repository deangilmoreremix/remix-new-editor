import React from 'react';
import PropTypes from '../../lib/PropTypes';

const InfiniteLoading = ({ className }) => (
  <div className={className}>Loading...</div>
);

InfiniteLoading.propTypes = {
  className: PropTypes.string,
};

export default InfiniteLoading;
