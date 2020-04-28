import React, { Fragment, useState } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';
import { useDropzone } from 'react-dropzone';

import PropTypes from '../../lib/PropTypes';
import mediaConstants from '../../lib/constants/media';
import { showError } from '../../lib/services/alertService';

import useMediaStore from '../hooks/useMediaStore';

import svgAudio from '../../public/static/images/media/icon-audio.svg';
import svgVideo from '../../public/static/images/media/icon-video.svg';
import svgImage from '../../public/static/images/media/icon-image.svg';
import arrowIcon from '../../public/static/svgImages/arrow-upper-left.svg';

const DropzoneArea = (
  {
    onUploaded,
    startUpload,
    endUpload,
    type,
    isDisabled,
    inline,
    multiple,
    value,
    className,
    isArrows,
  }) => {
  const [image, setImage] = useState();
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
          setImage(elements[0].url);
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
  });

  if (inline) {
    return (
      <div
        {...getRootProps()}
        className={classnames(
          'drag-drop',
          className,
          {
            'drag-drop-active': isDragActive,
            'drag-drop-disabled': isDisabled,
          },
        )}
      >
        <input {...getInputProps()} disabled={isDisabled} multiple={multiple} />

        {
          image || value
            ? <img src={image || value} alt="" />
            : (<p className="drag-drop__text">Drag and drop an image here, or click to upload</p>)
        }
        {
          !image && !value && isArrows && (
            <Fragment>
              <SVGInline className="drag-arrow drag-arrow-upper-left" svg={arrowIcon} cleanup={['arrow']} />
              <SVGInline className="drag-arrow drag-arrow-upper-right" svg={arrowIcon} cleanup={['arrow']} />
              <SVGInline className="drag-arrow drag-arrow-bottom-left" svg={arrowIcon} cleanup={['arrow']} />
              <SVGInline className="drag-arrow drag-arrow-bottom-right" svg={arrowIcon} cleanup={['arrow']} />
            </Fragment>
          )
        }
      </div>
    );
  }

  return (
    <div {...getRootProps()} className={classnames('dropzone-container', className)}>
      <input {...getInputProps()} disabled={isDisabled} multiple={multiple} />
      <div className={classnames('dropzone-placeholder', { drag: isDragActive })}>
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
  inline: PropTypes.bool,
  onUploaded: PropTypes.func,
  type: PropTypes.string.isRequired,
  startUpload: PropTypes.func,
  endUpload: PropTypes.func,
  isDisabled: PropTypes.bool,
  multiple: PropTypes.bool,
  value: PropTypes.string,
  className: PropTypes.string,
  isArrows: PropTypes.bool,
};

DropzoneArea.defaultProps = {
  inline: true,
  isDisabled: false,
  multiple: true,
  isArrows: true,
};

export default DropzoneArea;
