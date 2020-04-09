import React from 'react';
import TagsInput from 'react-tagsinput';

import PropTypes from '../../lib/PropTypes';

const TagsFormInput = ({ value, onChange, className, placeholder }) => (
  <TagsInput
    value={value}
    onChange={onChange}
    className={className}
    placeholder={placeholder}
  />
);

TagsFormInput.propTypes = {
  value: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  placeholder: PropTypes.string,
};

export default TagsFormInput;
