import React from 'react';
import TagsInput from 'react-tagsinput';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const TagsFormInput = ({ value = [], onChange, className, placeholder, label, labelClassName = '', disabled }) => (
  <div className={classnames('tags-input-block', className)}>
    {label && (
    <p className={classnames('tags-input-title', labelClassName)}>
      {label}
    </p>
    )}
    <TagsInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      addOnBlur
      disabled={disabled}
      onlyUnique
    />
  </div>
);

TagsFormInput.propTypes = {
  value: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  placeholder: PropTypes.string,
  label: PropTypes.string,
  labelClassName: PropTypes.string,
  disabled: PropTypes.bool,
};

export default TagsFormInput;
