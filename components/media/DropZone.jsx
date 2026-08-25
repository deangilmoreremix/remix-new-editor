import React, { forwardRef } from 'react';
import { useDropzone } from 'react-dropzone';

import PropTypes from '../../lib/PropTypes';

import { LibrarySpinner } from './Loader';

const DropZone = forwardRef((
  {
    accept,
    onDrop,
    isDisabled,
    multiple,
    className,
  }, ref) => {
  const { getInputProps } = useDropzone({
    accept,
    onDrop,
    disabled: isDisabled,
  });

  return (
    <div className={className}>
      <label className="button-add-file__label">
        <input {...getInputProps()} ref={ref} disabled={isDisabled} multiple={multiple} />
        {
          isDisabled ? <LibrarySpinner /> : <span>Upload</span>
        }
      </label>
    </div>
  );
});

DropZone.propTypes = {
  isDisabled: PropTypes.bool,
  multiple: PropTypes.bool,
  className: PropTypes.string,
  accept: PropTypes.arrayOf(PropTypes.string).isRequired,
  onDrop: PropTypes.func.isRequired,
};

DropZone.defaultProps = {
  isDisabled: false,
  multiple: true,
};

export default DropZone;
