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
    inputRef,
  } = props;
  const onEdit = ({ target: { value: v } }) => {
    onChange(v);
  };
  return (
    <div className={classnames('container-textarea', className)}>
      {text && label && <p className={classnames('text-area-label', textClassName)}>{label}</p>}
      <TextField
        id={label}
        className={classnames(inputClassName, 'text-area')}
        value={value || ''}
        placeholder={placeholder}
        onChange={onEdit}
        label={!text && label}
        multiline
        rows={rows}
        variant={variant}
        inputRef={inputRef}
      />
    </div>
  );
};
FormTextArea.propTypes = {
  onChange: PropTypes.func,
  label: PropTypes.string,
  text: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  textClassName: PropTypes.string,
  placeholder: PropTypes.string,
  rows: PropTypes.string,
  variant: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  inputRef: PropTypes.shape({}),
};
FormTextArea.defaultProps = {
  label: '',
  rows: 3,
  variant: 'outlined',
};
export default FormTextArea;
