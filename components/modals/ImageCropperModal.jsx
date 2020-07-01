import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import { Box } from '@material-ui/core';

import ImageCropper from '../common/ImageCropper';
import { CROP_RECOMMENDED_RESOLUTION } from '../../lib/constants/settings/image';

const ImageCropperModal = observer(({ handleClose, options }) => {
  const { imageMeta, recommendedResolution, onImageCropped, updateField } = useMemo(
    () => options, [options]);
  return (
    <div className="image-cropper-modal">
      <Box>
        <ImageCropper
          imageData={imageMeta || { }}
          resolution={recommendedResolution || CROP_RECOMMENDED_RESOLUTION}
          onImageCropped={(value) => onImageCropped(value.source, updateField)}
          handleClose={handleClose}
        />
      </Box>
    </div>
  );
});

export default ImageCropperModal;
