import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import ImglyImageEditor from '../common/ImglyImageEditor';

const ImglyImageEditorModal = observer(({ handleClose, options }) => {
  const { imageMeta, ...rest } = useMemo(
    () => options, [options]);

  if (!imageMeta) {
    return null;
  }

  return (
    <div className="image-editor-modal">
      <ImglyImageEditor
        imageData={imageMeta}
        handleClose={handleClose}
        {...rest}
      />
    </div>
  );
});

export default ImglyImageEditorModal;
