import React from 'react';
import SVGInline from 'react-svg-inline';
import cn from 'classnames';
import { useDropzone } from 'react-dropzone';

// ASSETS
import svgAudio from '../../public/static/images/media/icon-audio.svg';
import svgVideo from '../../public/static/images/media/icon-video.svg';
import svgImage from '../../public/static/images/media/icon-image.svg';

// HOOKS
import useMediaStore from '../hooks/useMediaStore';

// TYPES
import PropTypes from '../../lib/PropTypes';

// CONSTANTS
import mediaConstants from '../../lib/constants/media';

const DropzoneArea = ({ onUploaded }) => {
  const { uploadMedia, isLoading: disabled } = useMediaStore();

  const onDrop = React.useCallback(acceptedFiles => {
    Promise.all(acceptedFiles.map(async data => {
      const asset = await uploadMedia({ data, preview: true });
      onUploaded(asset);
    }));
  }, [uploadMedia]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled,
  });

  return (
    <div {...getRootProps()} className="dropzone-container">
      <input {...getInputProps()} />
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
  onUploaded: PropTypes.func.isRequired,
};

export default DropzoneArea;
