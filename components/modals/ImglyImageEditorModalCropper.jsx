import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import ImglyImageEditorCropper from '../common/ImglyImageEditorCropper';

const ImglyImageEditorModalCropper = observer(({ handleClose, options }) => {
  const { imageMeta, ...rest } = useMemo(
    () => options, [options]);
  if (!imageMeta) {
    return null;
  }

  return (
    <div className="image-editor-modal">
      <ImglyImageEditorCropper
        imageData={imageMeta}
        handleClose={handleClose}
        {...rest}
      />
    </div>
  );
});

export default ImglyImageEditorModalCropper;
