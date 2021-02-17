import React, { useRef } from 'react';
import classnames from 'classnames';

import { ASSET_TYPES, GIF_FORMAT, GIF_WARNING, IMAGE_FORMATS } from '../../lib/constants/media';
import { produceTooltips } from '../../lib/constants/tooltips';
import { showError } from '../../lib/services/alertService';
import PropTypes from '../../lib/PropTypes';

import useMediaStore from '../hooks/useMediaStore';
import useModalStore from '../hooks/useModalStore';
import useProjectStore from '../hooks/useProjectStore';

import { CROP_RECOMMENDED_RESOLUTION } from '../../lib/constants/settings/image';
import DropZone from './DropZone';
import DropzoneArea from './DropzoneArea';
import HelpIconComponent from '../common/HelpIcon';

const IMAGE_FORMATS_WITH_GIF = [...IMAGE_FORMATS, GIF_FORMAT];

const DropAndEditButton = (
  {
    isArea,
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
    ...rest
  }) => {
  const { uploadMedia, saveFile } = useMediaStore();
  const { openCropper } = useModalStore();
  const { showWarning } = useProjectStore();

  const uploadButtonRef = useRef();

  const props = React.useMemo(() => ({
    multiple: false,
    accept: allowedGif ? IMAGE_FORMATS_WITH_GIF : IMAGE_FORMATS,
  }), []);

  const onDrop = React.useCallback(async (acceptedFiles, rejectedFiles) => {
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
        await save(media && media.url, image.type);
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

  const save = React.useCallback(async (src, type) => {
    if (startUpload) {
      startUpload();
    }
    const result = await saveFile(src, needSaveAsset, ASSET_TYPES.IMAGE);
    onUploaded(result, type);
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
        <>
          <DropZone
            onDrop={onDrop}
            ref={uploadButtonRef}
            className={classnames('button-add-file', className)}
            {...props}
            {...rest}
          />
          <HelpIconComponent
            isText
            message={produceTooltips.thumbnailUpload}
          />
        </>
      )
    }
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
  zoomable: PropTypes.bool,
  tooltipMessage: PropTypes.string,
  allowedGif: PropTypes.bool,
  recommendedResolution: PropTypes.shape({
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
  }),
};

DropAndEditButton.defaultProps = {
  isDisabled: false,
  needSaveAsset: true,
  allowedGif: false,
};

export default DropAndEditButton;
