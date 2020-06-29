import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import { Box } from '@material-ui/core';

import TuiImageEditor from '../common/TuiImageEditor';

const TuiImageEditorModal = observer(({ handleClose, options }) => {
  const { imageMeta, recommendedResolution, onImageCropped, updateField } = useMemo(
    () => options, [options]);

  return (
    <div className="image-editor-modal">
      <Box>
        <TuiImageEditor
          imageData={imageMeta || {}}
          resolution={recommendedResolution}
          onImageCropped={(value) => onImageCropped(value.source, updateField)}
          handleClose={handleClose}
        />
      </Box>
    </div>
  );
});

export default TuiImageEditorModal;
