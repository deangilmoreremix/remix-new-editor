import React from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';

import useProjectStore from '../../hooks/useProjectStore';

import SnackBar from './SnackBar';

const Warning = observer((
  {
    message,
    autoHideDuration,
    autoClose,
    handleClose,
    contentClassName,
    className,
  }) => {
  const { showWarning } = useProjectStore();

  return (
    <SnackBar
      message={message}
      handleClose={handleClose || showWarning}
      contentClassName={classnames('warning-snackbar-content', contentClassName)}
      className={classnames('warning-snackbar', className)}
      autoClose={autoClose}
      autoHideDuration={autoHideDuration}
    />
  );
});
Warning.propTypes = {
  message: PropTypes.string,
  autoHideDuration: PropTypes.number,
  autoClose: PropTypes.bool,
  handleClose: PropTypes.func,
  className: PropTypes.string,
};

Warning.defaultProps = {
  autoClose: true,
  autoHideDuration: 6000,
};

export default Warning;
