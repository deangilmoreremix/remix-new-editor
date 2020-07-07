import React from 'react';
import { useDropzone } from 'react-dropzone';
import classnames from 'classnames';
import lottie from 'lottie-web';

import mediaConstants from '../../lib/constants/media';
import { showError } from '../../lib/services/alertService';
import PropTypes from '../../lib/PropTypes';
import { loadUrl } from '../../lib/requestCreator';

import useMediaStore from '../hooks/useMediaStore';

import { LibrarySpinner } from './Loader';

const DropButton = (
  {
    accept,
    onUploaded,
    type,
    startUpload,
    endUpload,
    isDisabled,
    multiple,
    className,
    needSaveAsset,
    getDuration,
  }) => {
  const { uploadMedia, storeAsset } = useMediaStore();

  const onDrop = React.useCallback(acceptedFiles => {
    const elements = [];
    if (startUpload) {
      startUpload(acceptedFiles);
    }

    Promise.all(acceptedFiles.map(async data => {
      const asset = await uploadMedia({ data });
      if (needSaveAsset) {
        const element = await storeAsset(asset, type.toUpperCase());
        elements.push(element);
      } else {
        elements.push(asset);
      }
      return asset.url.match(/\.[0-9a-z]{1,5}$/)[0];
    }))
      .then(async fileExtension => {
        const extension = fileExtension[fileExtension.length - 1];
        if (!multiple) {
          let duration = null;
          if (getDuration) {
            const animationData = await loadUrl(elements[0].url);
            const animation = await lottie.loadAnimation({ animationData });
            duration = animation.totalFrames / animation.animationData.fr;
            elements[0].duration = duration;
          }
          onUploaded(elements[0], extension);
        } else {
          onUploaded(elements, extension);
        }
      })
      .catch(() => showError('An error occurred while loading the items.'))
      .finally(() => {
        if (endUpload) {
          endUpload();
        }
      });
  }, [onUploaded, uploadMedia]);

  const { getInputProps } = useDropzone({
    accept: accept && accept.length ? accept : mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
  });

  return (
    <div className={classnames('button-add-file', className)}>
      <label className="button-add-file__label">
        <input {...getInputProps()} disabled={isDisabled} multiple={multiple} />
        {
          isDisabled ? <LibrarySpinner /> : <span>Upload</span>
        }
      </label>
    </div>
  );
};

DropButton.propTypes = {
  onUploaded: PropTypes.func.isRequired,
  type: PropTypes.string.isRequired,
  startUpload: PropTypes.func,
  endUpload: PropTypes.func,
  isDisabled: PropTypes.bool,
  multiple: PropTypes.bool,
  className: PropTypes.string,
  needSaveAsset: PropTypes.bool,
  accept: PropTypes.arrayOf(PropTypes.string),
  getDuration: PropTypes.bool,
};

DropButton.defaultProps = {
  isDisabled: false,
  multiple: true,
  needSaveAsset: true,
};

export default DropButton;
