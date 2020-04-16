import React from 'react';
import { useDropzone } from 'react-dropzone';
import classnames from 'classnames';

import mediaConstants from '../../lib/constants/media';
import { showError } from '../../lib/services/alertService';
import PropTypes from '../../lib/PropTypes';

import useMediaStore from '../hooks/useMediaStore';

import { LibrarySpinner } from './Loader';

const DropButton = (
  {
    onUploaded,
    type,
    startUpload,
    endUpload,
    isDisabled,
    multiple,
    className,
  }) => {
  const { uploadMedia, storeAsset } = useMediaStore();

  const onDrop = React.useCallback(acceptedFiles => {
    const elements = [];
    if (startUpload) {
      startUpload();
    }

    Promise.all(acceptedFiles.map(async data => {
      const asset = await uploadMedia({ data });
      const element = await storeAsset(asset, type.toUpperCase());
      const fileExtension = element.url.match(/\.[0-9a-z]{1,5}$/)[0];
      elements.push(element);
      return fileExtension;
    }))
      .then(fileExtension => {
        const extension = fileExtension[fileExtension.length - 1];
        if (!multiple) {
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
  }, [uploadMedia]);

  const { getInputProps } = useDropzone({
    accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
  });

  return (
    <div className={classnames('button-add-file', className)}>
      <input id="settings-file" {...getInputProps()} disabled={isDisabled} multiple={multiple} />
      <label htmlFor="settings-file" className="button-add-file__label">
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
};

DropButton.defaultProps = {
  isDisabled: false,
  multiple: true,
};

export default DropButton;
