import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import PixoImageEditor from '../common/PixoImageEditor';

const PixoImageEditorModal = observer(({ handleClose, options }) => {
  const { imageMeta, ...rest } = useMemo(
    () => options, [options]);

  if (!imageMeta) {
    return null;
  }

  return (
    <div className="image-editor-modal">
      <PixoImageEditor
        imageData={imageMeta}
        handleClose={handleClose}
        {...rest}
      />
    </div>
  );
});

export default PixoImageEditorModal;
