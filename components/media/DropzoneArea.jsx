import React, { Fragment } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';
import { useDropzone } from 'react-dropzone';

import PropTypes from '../../lib/PropTypes';
import mediaConstants from '../../lib/constants/media';

import svgAudio from '../../public/static/images/media/icon-audio.svg';
import svgVideo from '../../public/static/images/media/icon-video.svg';
import svgImage from '../../public/static/images/media/icon-image.svg';
import arrowIcon from '../../public/static/svgImages/arrow-upper-left.svg';

const DropzoneArea = (
  {
    accept,
    isDisabled,
    inline,
    multiple,
    value,
    className,
    isArrows,
    onDrop
  }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: accept && accept.length ? accept : mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: isDisabled,
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
          value
            ? <img src={value} alt="" />
            : (<p className="drag-drop__text">Drag and drop an image here, or click to upload</p>)
        }
        {
          !value && isArrows
            && (
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
  className: PropTypes.string,
  isArrows: PropTypes.bool,
  multiple: PropTypes.bool,
  value: PropTypes.string,
  inline: PropTypes.bool,
  isDisabled: PropTypes.bool,
  accept: PropTypes.arrayOf(PropTypes.string),
  onDrop: PropTypes.func.isRequired,
};

DropzoneArea.defaultProps = {
  inline: true,
  isDisabled: false,
  multiple: true,
  isArrows: true,
};

export default DropzoneArea;
