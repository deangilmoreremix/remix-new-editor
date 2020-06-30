import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';

import mediaConstants from '../../lib/constants/media';
import PropTypes from '../../lib/PropTypes';

import { ENTER_KEY } from '../../lib/constants/keyCodes';

const DropPasteInput = (
  {
    accept,
    onDrop,
    isDisabled,
    onEnter,
    placeholder,
  }) => {
  const [currentValue, setCurrentValue] = useState('');

  const { getInputProps, getRootProps } = useDropzone({
    accept: accept && accept.length ? accept : mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
    noClick: true,
    noKeyboard: true,
  });

  const onChange = ({ target: { value: v } }) => {
    setCurrentValue(v);
  };

  const onKeyPress = (e) => {
    if (e.which === ENTER_KEY) {
      e.preventDefault();
      onEnter(currentValue);
    }
  };

  React.useEffect(() => {
  }, [currentValue]);


  return (
    <div className="container-textarea">
      <textarea
        {...getRootProps()}
        className="text-input"
        value={currentValue}
        onKeyPress={onKeyPress}
        onChange={onChange}
        placeholder={placeholder}
      />
      <input {...getInputProps()} disabled={isDisabled} multiple={false} />
      <p className="label">Paste or drop media to upload</p>
    </div>
  );
};

DropPasteInput.propTypes = {
  onDrop: PropTypes.func.isRequired,
  onEnter: PropTypes.func.isRequired,
  startUpload: PropTypes.func,
  isDisabled: PropTypes.bool,
  accept: PropTypes.arrayOf(PropTypes.string),
  placeholder: PropTypes.string,
};

DropPasteInput.defaultProps = {
  placeholder: 'Drop your file here to start uploading it. Paste the URL/Link to external video hosting (Youtube, Vimeo, etc)',
};

export default DropPasteInput;
