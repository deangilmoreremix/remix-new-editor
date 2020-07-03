import React from 'react';
import { useDropzone } from 'react-dropzone';
import classnames from 'classnames';

import mediaConstants, { ASSET_TYPES } from '../../lib/constants/media';
import { showError } from '../../lib/services/alertService';
import PropTypes from '../../lib/PropTypes';

import useMediaStore from '../hooks/useMediaStore';

import { LibrarySpinner } from './Loader';
import { CROP_RECOMMENDED_RESOLUTION } from '../../lib/constants/settings/image';
import { IMAGE_TYPE } from '../../lib/constants/imageEditor/tuiEditor';
import useModalStore from '../hooks/useModalStore';

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
  }) => {
  const { uploadMedia, storeAsset } = useMediaStore();

  const { openImageEditor, finishImageEditing } = useModalStore();

  const onDrop = React.useCallback((image) => {
    image.url = URL.createObjectURL(image);
    openImageEditor(image.url, () => {}, IMAGE_TYPE.THUMBNAIL, CROP_RECOMMENDED_RESOLUTION);

    // todo uncomment it
    // Promise.all(acceptedFiles.map(async data => {
    //   const asset = await uploadMedia({ data });
    //   if (needSaveAsset) {
    //     const element = await storeAsset(asset, type.toUpperCase());
    //     elements.push(element);
    //   } else {
    //     elements.push(asset);
    //   }
    //   return asset.url.match(/\.[0-9a-z]{1,5}$/)[0];
    // }))
    //   .then(fileExtension => {
    //     const extension = fileExtension[fileExtension.length - 1];
    //     if (!multiple) {
    //       onUploaded(elements[0], extension);
    //     } else {
    //       onUploaded(elements, extension);
    //     }
    //   })
    //   .catch(() => showError('An error occurred while loading the items.'))
    //   .finally(() => {
    //     if (endUpload) {
    //       endUpload();
    //     }
    //   });
  }, [onUploaded, uploadMedia]);

  const { getInputProps } = useDropzone({
    accept: accept && accept.length ? accept : mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
  });

  return (
    <DropButton type={ASSET_TYPES.IMAGE} onUploaded={onDrop} />
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
};

DropButton.defaultProps = {
  isDisabled: false,
  multiple: true,
  needSaveAsset: true,
};

export default DropButton;
