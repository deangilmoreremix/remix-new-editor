import React from 'react';

import PropTypes from '../../../lib/PropTypes';

import SnackBar from './SnackBar';

const Error = ({ handleClose, message, autoClose }) => {
  if (!message) {
    return null;
  }
  return (
    <SnackBar
      message={message}
      handleClose={handleClose}
      autoClose={autoClose}
    />
  );
};

Error.propTypes = {
  handleClose: PropTypes.func.isRequired,
  message: PropTypes.string,
  autoClose: PropTypes.bool,
};

Error.defaultProps = {
  autoClose: true,
};

export default Error;
