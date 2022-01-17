import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import AdvancedImageEditor from '../common/AdvanceImageEditor';

const AdvancedImageEditorModal = observer(({ handleClose, options }) => {
  console.log(options, 'this is options');
  const { imageMeta, ...rest } = useMemo(
    () => options, [options]);

  if (!imageMeta) {
    return null;
  }

  // console.log(...rest, 'This is image meta');

  return (
    <div className="image-editor-modal">
      <AdvancedImageEditor
        imageData={imageMeta}
        handleClose={handleClose}
        {...rest}
      />
    </div>
  );
});

export default AdvancedImageEditorModal;
