import React, { useRef, useMemo, useCallback } from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import { showConfirmation, showError, showSuccess } from '../../lib/services/alertService';
import PropTypes from '../../lib/PropTypes';

import useMediaStore from '../hooks/useMediaStore';
import useModalStore from '../hooks/useModalStore';
import useProjectStore from '../hooks/useProjectStore';

import { CROP_RECOMMENDED_RESOLUTION } from '../../lib/constants/settings/image';
import { ASSET_TYPES, GIF_FORMAT, GIF_WARNING, IMAGE_FORMATS } from '../../lib/constants/media';

import DropZone from './DropZone';
import DropzoneArea from './DropzoneArea';
import HelpIconComponent from '../common/HelpIcon';

import removeIcon from '../../public/static/svgImages/common/remove-image-icon.svg';

const IMAGE_FORMATS_WITH_GIF = [...IMAGE_FORMATS, GIF_FORMAT];

const DropAndEditButton = (
  {
    isArea,
    isRemovable,
    onUploaded,
    startUpload,
    endUpload,
    className,
    needSaveAsset,
    recommendedResolution,
    tooltipMessage,
    zoomable,
    openImageEditor,
    allowedGif,
    fallbackValue,
    AiGeneratoreImage,
    ...rest
  }) => {
  const { uploadMedia, saveFile } = useMediaStore();
  const { openCropper } = useModalStore();
  const { showWarning,setSettingImageUplode } = useProjectStore();

  const uploadButtonRef = useRef();
  const props = useMemo(() => ({
    multiple: false,
    accept: allowedGif ? IMAGE_FORMATS_WITH_GIF : IMAGE_FORMATS,
  }), []);

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    if (!acceptedFiles.length) {
      if (rejectedFiles.length > 0) {
        return showError('Wrong Format!');
      }
      return;
    }

    if (uploadButtonRef.current) {
      uploadButtonRef.current.value = '';
    }

    const image = acceptedFiles[0];
    image.src = URL.createObjectURL(image);

    if (image.type === GIF_FORMAT) {
      try {
        startUpload();
        const media = await uploadMedia({ data: image });
        console.log("media>>",media)
        await save(media && media.url, image.type);
        console.log("media>>",media,media.url,image.type)
        endUpload();
        showWarning(GIF_WARNING);
      } catch (e) {
        showError(e.message);
      }
    } else {
      return openCropper({
        image,
        onImageCropped: save,
        openImageEditor,
        recommendedResolution: recommendedResolution || CROP_RECOMMENDED_RESOLUTION,
        cancelCropper: () => save(image),
        startUpload,
        endUpload,
        zoomable,
      });
    }
  }, [uploadMedia]);

  const save = useCallback(async (src, type) => {
    if (startUpload) {
      startUpload();
    }
    const result = await saveFile(src, needSaveAsset, ASSET_TYPES.IMAGE);
    onUploaded(result, type);
    setSettingImageUplode(result.url)
    if (endUpload) {
      endUpload();
    }
  }, [onUploaded]);

  const onRemoveImage = useCallback(async () => {
    const response = await showConfirmation('Are you sure you want to remove the image?', 'Remove image');
    if (response) {
      onUploaded(!!fallbackValue && { url: fallbackValue });
      showSuccess('Image is successfully removed');
    }
  }, [uploadMedia]);

  return (
    <div className="drop-area">
      {isArea ? (
        <>
          <DropzoneArea
            onDrop={onDrop}
            {...props}
            {...rest}
          />
          {isRemovable && (
            <SVGInline
              svg={removeIcon}
              className="drop-area__icon"
              onClick={onRemoveImage}
            />
          )}
        </>
      ) : (
        <>
          <DropZone
            onDrop={onDrop}
            ref={uploadButtonRef}
            className={classnames('button-add-file', className)}
            {...props}
            {...rest}
          />
          {tooltipMessage && (
            <HelpIconComponent
              isText
              message={tooltipMessage}
            />
          )}
        </>
      )}
    </div>
  );
};

DropAndEditButton.propTypes = {
  onUploaded: PropTypes.func.isRequired,
  startUpload: PropTypes.func,
  openImageEditor: PropTypes.func,
  endUpload: PropTypes.func,
  isDisabled: PropTypes.bool,
  className: PropTypes.string,
  needSaveAsset: PropTypes.bool,
  isArea: PropTypes.bool,
  isRemovable: PropTypes.bool,
  zoomable: PropTypes.bool,
  tooltipMessage: PropTypes.string,
  allowedGif: PropTypes.bool,
  fallbackValue: PropTypes.string,
  recommendedResolution: PropTypes.shape({
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
  }),
};

DropAndEditButton.defaultProps = {
  isDisabled: false,
  needSaveAsset: true,
  allowedGif: false,
  isRemovable: false,
};

export default DropAndEditButton;
