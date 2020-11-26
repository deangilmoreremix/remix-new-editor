import React from 'react';
import { observer } from 'mobx-react';

import { Box, Button } from '@material-ui/core';
import PropTypes from '../../lib/PropTypes';

const ImageButtons = observer(({
  handleClose,
  uploadFile,
  extraStep,
  handleExtraStep,
}) => (
  <Box className="img-size-settings cropper-buttons">
    <Button
      variant="outlined"
      color="default"
      className="border-button"
      onClick={handleClose}
    >
       Cancel
    </Button>
    <Button
      variant="outlined"
      color="default"
      className="base-button"
      onClick={uploadFile}
    >
      Apply
    </Button>
    {
      extraStep
        ? (
          <Button
            variant="outlined"
            color="default"
            className="base-button"
            onClick={handleExtraStep}
          >
            {extraStep}
          </Button>
        ) : null
    }
  </Box>
));

ImageButtons.propTypes = {
  uploadFile: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
  handleExtraStep: PropTypes.func,
  extraStep: PropTypes.string,
};

export default ImageButtons;
