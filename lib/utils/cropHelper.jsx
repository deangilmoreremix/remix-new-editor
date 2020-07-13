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
  const { recommendedResolution, imageMeta } = options;
  if (!imageMeta) {
    return false;
  }
  return (recommendedResolution && (recommendedResolution.width !== imageMeta.width
    || recommendedResolution.height !== imageMeta.height));
};

const fields = [
  { editableField: 'minWidth', value: 'width' },
  { editableField: 'maxWidth', value: 'width' },
  { editableField: 'minHeight', value: 'height' },
  { editableField: 'maxHeight', value: 'height' },
];

export const setMinMax = (refEditor, auto) => {
  const { cropper } = refEditor.current;
  fields.forEach(fieldProps => {
    const fieldName = auto ? fieldProps.value : fieldProps.editableField;
    cropper.cropBoxData[fieldProps.editableField] = cropper.initialCropBoxData[fieldName];
  });
};

export function checkImageResolution(options) {
  const { openCropper, cancelCropper } = options;
  if (isResolutionWrong(options) && options.imageMeta && options.imageMeta.source) {
    openCropper(options);
  } else {
    cancelCropper(options);
  }
}
