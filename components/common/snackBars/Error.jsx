import React from 'react';
import SVGInline from 'react-svg-inline';
import { Button, Snackbar } from '@material-ui/core';

import PropTypes from '../../../lib/PropTypes';
import closeIcon from '../../../public/static/svgImages/close.svg';

const Error = ({ handleClose, open, message }) => {
  if (!message) {
    return null;
  }
  return (
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={handleClose}
      ContentProps={{
        'aria-describedby': 'snackbar-fab-message-id',
        className: 'error-snackbar-content',
      }}
      action={(
        <Button color="inherit" size="small" onClick={handleClose}>
          <SVGInline
            className="icon-button"
            svg={closeIcon}
            cleanup={['title']}
          />
        </Button>
)}
      message={<span id="snackbar-fab-message-id">{message}</span>}
      className="error-snackbar"
    />
  );
};

Error.propTypes = {
  handleClose: PropTypes.func.isRequired,
  open: PropTypes.bool,
  message: PropTypes.string,
};

export default Error;
