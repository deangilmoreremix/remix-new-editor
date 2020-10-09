import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';

import useProjectStore from '../../hooks/useProjectStore';

import SnackBar from './SnackBar';

const Warning = observer(({ message, autoClose }) => {
  const { showSuccess } = useProjectStore();

  return (
    <SnackBar
      message={message}
      handleClose={() => showSuccess()}
      contentClassName="success-snackbar-content"
      className="success-snackbar"
      autoClose={autoClose}
    />
  );
});

Warning.propTypes = {
  message: PropTypes.string,
  autoClose: PropTypes.bool,
};

Warning.defaultProps = {
  autoClose: true,
};

export default Warning;
