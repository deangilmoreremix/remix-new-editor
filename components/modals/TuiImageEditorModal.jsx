import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import { Box } from '@material-ui/core';

import TuiImageEditor from '../common/TuiImageEditor';
import { TUI_EDITOR_RECOMMENDED_RESOLUTION } from '../../lib/constants/settings/image';

const TuiImageEditorModal = observer(({ handleClose, options }) => {
  const { imageMeta, onImageCropped, updateField } = useMemo(
    () => options, [options]);
  return (
    <div className="image-editor-modal">
      <Box>
        <TuiImageEditor
          imageData={imageMeta || {}}
          resolution={TUI_EDITOR_RECOMMENDED_RESOLUTION}
          onImageCropped={(value) => onImageCropped(value.source, updateField)}
          handleClose={handleClose}
        />
      </Box>
    </div>
  );
});

export default TuiImageEditorModal;
