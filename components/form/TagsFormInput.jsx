import React from 'react';
import TagsInput from 'react-tagsinput';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const TagsFormInput = ({ value, onChange, className, placeholder, title, titleClass = '' }) => (
  <div className={classnames('tags-input-block', className)}>
    {title && (
      <p className={classnames('tags-input-title', titleClass)}>
        {title}
      </p>
    )}
    <TagsInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      addOnBlur
    />
  </div>
);

TagsFormInput.propTypes = {
  value: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  placeholder: PropTypes.string,
  title: PropTypes.string,
  titleClass: PropTypes.string,
};

export default TagsFormInput;
