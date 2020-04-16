import React from 'react';
import TextField from '@material-ui/core/TextField';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const FormTextArea = (props) => {
  const {
    label,
    onChange,
    inputClassName,
    className,
    placeholder,
    value,
    rows,
    variant,
  } = props;

  const onEdit = ({ target: { value: v } }) => {
    onChange(v);
  };

  return (
    <div className={classnames('container-textarea', className)}>
      <TextField
        id={label}
        className={classnames(inputClassName, 'text-area')}
        value={value || ''}
        placeholder={placeholder}
        onChange={onEdit}
        label={label}
        multiline
        rows={rows}
        variant={variant}
      />
    </div>
  );
};

FormTextArea.propTypes = {
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  placeholder: PropTypes.string,
  rows: PropTypes.string,
  variant: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

FormTextArea.defaultProps = {
  label: '',
  rows: 3,
};

export default FormTextArea;
