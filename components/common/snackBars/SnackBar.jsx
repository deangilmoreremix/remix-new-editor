import React from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';
import { Button, Snackbar } from '@material-ui/core';

import PropTypes from '../../../lib/PropTypes';

import closeIcon from '../../../public/static/svgImages/close.svg';

const SnackBar = (
  {
    message,
    handleClose,
    className,
    contentClassName,
    autoHideDuration,
    autoClose,
  }) => (
    <Snackbar
      open={!!message}
      autoHideDuration={autoHideDuration}
      onClose={autoClose && handleClose}
      ContentProps={{
        'aria-describedby': 'snackbar-fab-message-id',
        className: classnames('snackbar-content', contentClassName),
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
      className={classnames('snackbar', className)}
    />
);

SnackBar.propTypes = {
  handleClose: PropTypes.func.isRequired,
  message: PropTypes.string.isRequired,
  className: PropTypes.string,
  contentClassName: PropTypes.string,
  autoHideDuration: PropTypes.num,
  autoClose: PropTypes.bool,
};

SnackBar.defaultProps = {
  autoHideDuration: 4000,
  autoClose: false,
};

export default SnackBar;
