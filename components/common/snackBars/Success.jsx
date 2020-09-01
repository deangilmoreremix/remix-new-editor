import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';

import useProjectStore from '../../hooks/useProjectStore';

import SnackBar from './SnackBar';

const Warning = observer(({ message }) => {
  const { showSuccess } = useProjectStore();

  return (
    <SnackBar
      message={message}
      handleClose={() => showSuccess()}
      contentClassName="success-snackbar-content"
      className="success-snackbar"
    />
  );
});

Warning.propTypes = {
  message: PropTypes.string,
};

export default Warning;
