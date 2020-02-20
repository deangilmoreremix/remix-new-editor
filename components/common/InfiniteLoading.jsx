import React from 'react';
import PropTypes from '../../lib/PropTypes';

const InfiniteLoading = (props) => {
  const { className } = props;
  return (
    <div
      className={`${className || ''} lds-ellipsis`}
    >
      <div />
      <div />
      <div />
      <div />
    </div>
  );
};

InfiniteLoading.propTypes = {
  className: PropTypes.string,
};

export default InfiniteLoading;
