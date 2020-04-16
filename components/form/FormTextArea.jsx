import React from 'react';
import TextField from '@material-ui/core/TextField';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const FormTextArea = (props) => {
  const {
    label,
    text,
    onChange,
    inputClassName,
    className,
    textClassName,
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
      {text && <p className={classnames(textClassName)}>{text}</p>}
      <TextField
        id={label}
        className={classnames(inputClassName, 'text-area', 'text-input')}
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
  text: PropTypes.string,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  textClassName: PropTypes.string,
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
