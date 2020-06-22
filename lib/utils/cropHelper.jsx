import React from 'react';

import ImageCropper from '../../components/common/ImageCropper';

export const modalContent = (options) => {
  const { recommendedResolution, imageMeta = {}, onFileUploaded } = options;
  return {
    header: 'Please select image area to use in project',
    content: <ImageCropper
      className="canvas"
      imageData={imageMeta}
      resolution={recommendedResolution}
      onImageCropped={(value) => {
        onFileUploaded(value);
      }}
    />,
  };
};
export const isResolutionWrong = (options) => {
  const { recommendedResolution, imageMeta = {} } = options;
  return (recommendedResolution && (recommendedResolution.width !== imageMeta.width
    || recommendedResolution.height !== imageMeta.height));
};

export function checkImageResolution(options) {
  const { onFileUploaded } = options;
  if (isResolutionWrong(options)) {
    onFileUploaded(options);
  }
}
