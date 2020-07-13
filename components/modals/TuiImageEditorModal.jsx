import React, { useMemo } from 'react';
import { observer } from 'mobx-react';
import { Box } from '@material-ui/core';

import TuiImageEditor from '../common/TuiImageEditor';

const TuiImageEditorModal = observer(({ handleClose, options }) => {
  const { imageMeta, ...rest } = useMemo(
    () => options, [options]);

  if (!imageMeta) {
    return null;
  }

  return (
    <div className="image-editor-modal">
      <Box>
        <TuiImageEditor
          imageData={imageMeta}
          handleClose={handleClose}
          {...rest}
        />
      </Box>
    </div>
  );
});

export default TuiImageEditorModal;
