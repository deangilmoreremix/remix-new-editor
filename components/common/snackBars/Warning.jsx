import React from 'react';
import SVGInline from 'react-svg-inline';
import { Button, Snackbar } from '@material-ui/core';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import closeIcon from '../../../public/static/svgImages/close.svg';

const Warning = observer(({ handleClose, message }) => {
  if (!message) {
    return null;
  }

  return (
    <Snackbar
      open={!!message}
      autoHideDuration={10000}
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
      className="warning-snackbar"
    />
  );
});

Warning.propTypes = {
  handleClose: PropTypes.func.isRequired,
  message: PropTypes.string,
};

export default Warning;
