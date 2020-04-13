import React from 'react';
import SVGInline from 'react-svg-inline';
import cn from 'classnames';
import { useDropzone } from 'react-dropzone';

import { tabItems } from '../../lib/constants/library';

import svgAudio from '../../public/static/images/media/icon-audio.svg';
import svgVideo from '../../public/static/images/media/icon-video.svg';
import svgImage from '../../public/static/images/media/icon-image.svg';
import useMediaStore from '../hooks/useMediaStore';
import PropTypes from '../../lib/PropTypes';
import mediaConstants from '../../lib/constants/media';
import { showError } from '../../lib/services/alertService';

const DropzoneArea = ({ onUploaded, startUpload, endUpload, type, isDisabled }) => {
  const { uploadMedia, storeAsset } = useMediaStore();

  const onDrop = React.useCallback(acceptedFiles => {
    const elements = [];
    startUpload();
    Promise.all(acceptedFiles.map(async data => {
      const asset = await uploadMedia({ data });
      const element = await storeAsset(asset, type.toUpperCase());
      const fileExtension = element.url.match(/\.[0-9a-z]{1,5}$/)[0];
      elements.push(element);
      return fileExtension;
    }))
      .then(fileExtension => {
        const extension = fileExtension[fileExtension.length - 1];
        onUploaded(elements, extension);
      })
      .catch(() => showError('An error occurred while loading the image.'))
      .finally(() => endUpload());
  }, [uploadMedia]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
  });

  return (
    <div {...getRootProps()} className="dropzone-container">
      <input {...getInputProps()} disabled={isDisabled} />
      <div className={cn('dropzone-placeholder', { drag: isDragActive })}>
        <SVGInline
          component="div"
          className="dropzone-placeholder-item"
          classSuffix="-inline"
          svg={svgAudio}
          cleanup={['title']}
        />
        <SVGInline
          component="div"
          className="dropzone-placeholder-item"
          classSuffix="-inline"
          svg={svgVideo}
          cleanup={['title']}
        />
        <SVGInline
          component="div"
          className="dropzone-placeholder-item"
          classSuffix="-inline"
          svg={svgImage}
          cleanup={['title']}
        />
        {isDragActive && <div className="overlay" />}
      </div>
    </div>
  );
};

DropzoneArea.propTypes = {
  inline: PropTypes.oneOf(['big', 'small']).isRequired,
  onUploaded: PropTypes.func.isRequired,
  type: PropTypes.string.isRequired,
  startUpload: PropTypes.func,
  endUpload: PropTypes.func,
  isDisabled: PropTypes.bool,
};

export default DropzoneArea;
