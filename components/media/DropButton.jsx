import React from 'react';
import classnames from 'classnames';

import mediaConstants from '../../lib/constants/media';
import { showError } from '../../lib/services/alertService';
import PropTypes from '../../lib/PropTypes';

import useMediaStore from '../hooks/useMediaStore';

import DropZone from './DropZone';
import DropzoneArea from './DropzoneArea';

const DropButton = (
  {
    isArea,
    accept,
    onUploaded,
    mediaType,
    startUpload,
    endUpload,
    isDisabled,
    multiple,
    className,
    needSaveAsset,
    ...rest
  }) => {
  const { uploadMedia, saveFiles } = useMediaStore();

  const acceptFormats = React.useMemo(() => (accept && accept.length ? accept
    : mediaConstants.ACCEPTED_MEDIA_TYPES), [accept]);

  const onDrop = React.useCallback(async (acceptedFiles, rejectedFiles) => {
    let result;
    if (!acceptedFiles.length) {
      if (rejectedFiles.length > 0) {
        return showError('Wrong Format!');
      }
      return;
    }

    if (startUpload) {
      startUpload();
    }

    try {
      result = await saveFiles(acceptedFiles, needSaveAsset, mediaType.toUpperCase(), multiple);
      onUploaded(result);
    } catch (e) {
      showError(e.message);
    } finally {
      if (endUpload) {
        endUpload();
      }
    }
  }, [onUploaded, uploadMedia]);

  return (
    <div className="drop-area">
      {
        isArea ? (
          <DropzoneArea
            onDrop={onDrop}
            multiple={multiple}
            isDisabled={isDisabled}
            accept={acceptFormats}
            {...rest}
          />
        ) : (
          <DropZone
            onDrop={onDrop}
            className={classnames('button-add-file', className)}
            multiple={multiple}
            isDisabled={isDisabled}
            accept={acceptFormats}
            {...rest}
          />
        )
      }
    </div>
  );
};

DropButton.propTypes = {
  onUploaded: PropTypes.func.isRequired,
  mediaType: PropTypes.string.isRequired,
  startUpload: PropTypes.func,
  endUpload: PropTypes.func,
  isDisabled: PropTypes.bool,
  multiple: PropTypes.bool,
  isArea: PropTypes.bool,
  className: PropTypes.string,
  needSaveAsset: PropTypes.bool,
  accept: PropTypes.arrayOf(PropTypes.string),
};

DropButton.defaultProps = {
  isDisabled: false,
  multiple: true,
  needSaveAsset: true,
};

export default DropButton;
