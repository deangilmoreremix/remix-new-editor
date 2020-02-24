import React from 'react';
import { PopupboxManager } from 'react-popupbox';

import ImageCropper from '../../components/common/ImageCropper';

export const modalContent = (options) => {
  const { recommendedResolution, imageMeta = {}, onFileUploaded } = options;
  return {
    content: <ImageCropper
      className="canvas"
      imageData={imageMeta}
      resolution={recommendedResolution}
      onImageCropped={(value) => {
        onFileUploaded(value);
      }}
    />,
    config: {
      titleBar: {
        enable: true,
        text: 'Please select image area to use in project',
      },
      fadeIn: true,
      fadeInSpeed: 250,
    },
  };
};
export const isResolutionWrong = (options) => {
  const { recommendedResolution, imageMeta = {} } = options;
  return (recommendedResolution && (recommendedResolution.width !== imageMeta.width
    || recommendedResolution.height !== imageMeta.height));
};

export function checkImageResolution(options) {
  const { imageMeta = {}, onFileUploaded, isNewModal } = options;
  if (isResolutionWrong(options)) {
    const action = isNewModal ? 'open' : 'update';
    return PopupboxManager[action](modalContent(options));
  }
  onFileUploaded(imageMeta);
}

export default {
  modalContent,
  isResolutionWrong,
  checkImageResolution,
};
