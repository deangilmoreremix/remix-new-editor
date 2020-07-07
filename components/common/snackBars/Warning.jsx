import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';

import useProjectStore from '../../hooks/useProjectStore';

import SnackBar from './SnackBar';

const Warning = observer(({ message }) => {
  const { showWarning } = useProjectStore();

  if (!message) {
    return null;
  }

  return (
    <SnackBar
      message={message}
      handleClose={() => showWarning()}
      contentClassName="warning-snackbar-content"
    />
  );
});

Warning.propTypes = {
  message: PropTypes.string,
};

export default Warning;
