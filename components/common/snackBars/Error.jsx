import React from 'react';

import PropTypes from '../../../lib/PropTypes';

import SnackBar from './SnackBar';

const Error = ({ handleClose, message }) => {
  if (!message) {
    return null;
  }
  return (
    <SnackBar
      message={message}
      handleClose={handleClose}
    />
  );
};

Error.propTypes = {
  handleClose: PropTypes.func.isRequired,
  message: PropTypes.string,
};

export default Error;
