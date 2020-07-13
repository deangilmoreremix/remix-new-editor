import React from 'react';
import classnames from 'classnames';

import { ASSET_TYPES, IMAGE_FORMATS } from '../../lib/constants/media';
import { showError } from '../../lib/services/alertService';
import PropTypes from '../../lib/PropTypes';

import useMediaStore from '../hooks/useMediaStore';

import { CROP_RECOMMENDED_RESOLUTION } from '../../lib/constants/settings/image';
import DropZone from './DropZone';
import useModalStore from '../hooks/useModalStore';
import DropzoneArea from './DropzoneArea';

const DropAndEditButton = (
  {
    isArea,
    onUploaded,
    startUpload,
    endUpload,
    className,
    needSaveAsset,
    recommendedResolution,
    ...rest
  }) => {
  const { uploadMedia, saveFile } = useMediaStore();

  const { openCropper } = useModalStore();

  const props = React.useMemo(() => ({
    multiple: false,
    accept: IMAGE_FORMATS,
  }), []);

  const onDrop = React.useCallback(async (acceptedFiles, rejectedFiles) => {
    if (!acceptedFiles.length) {
      if (rejectedFiles.length > 0) {
        return showError('Wrong Format!');
      }
      return;
    }

    const image = acceptedFiles[0];
    image.src = URL.createObjectURL(image);
    return openCropper({
      image,
      onImageCropped: save,
      recommendedResolution: recommendedResolution || CROP_RECOMMENDED_RESOLUTION,
      cancelCropper: () => save(image),
      startUpload,
      endUpload,
    });
  }, [uploadMedia]);

  const save = React.useCallback(async (src) => {
    if (startUpload) {
      startUpload();
    }
    const result = await saveFile(src, needSaveAsset, ASSET_TYPES.IMAGE);
    onUploaded(result);
    if (endUpload) {
      endUpload();
    }
  }, [onUploaded]);

  return (
    <div className="drop-area">
      {
      isArea ? (
        <DropzoneArea
          onDrop={onDrop}
          {...props}
          {...rest}
        />
      ) : (
        <DropZone
          onDrop={onDrop}
          className={classnames('button-add-file', className)}
          {...props}
          {...rest}
        />
      )
    }
    </div>
  );
};

DropAndEditButton.propTypes = {
  onUploaded: PropTypes.func.isRequired,
  startUpload: PropTypes.func,
  endUpload: PropTypes.func,
  isDisabled: PropTypes.bool,
  className: PropTypes.string,
  needSaveAsset: PropTypes.bool,
  isArea: PropTypes.bool,
  recommendedResolution: PropTypes.shape({
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
  }),
};

DropAndEditButton.defaultProps = {
  isDisabled: false,
  needSaveAsset: true,
};

export default DropAndEditButton;
