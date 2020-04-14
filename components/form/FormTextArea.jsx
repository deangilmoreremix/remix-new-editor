import React from 'react';
import TextField from '@material-ui/core/TextField';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const FormTextArea = (props) => {
  const {
    label,
    onChange,
    textAreaClassName,
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
    <form className={classnames('form-container-textarea', className)}>
      <div className={classnames('container-textarea', className)}>
        <TextField
          id={label}
          className={classnames(textAreaClassName, 'text-area')}
          value={value || ''}
          placeholder={placeholder}
          onChange={onEdit}
          label={label}
          multiline
          rows={rows}
          variant={variant}
        />
      </div>
    </form>
  );
};

FormTextArea.propTypes = {
  onChange: PropTypes.func,
  label: PropTypes.string,
  className: PropTypes.string,
  textAreaClassName: PropTypes.string,
  placeholder: PropTypes.string,
  rows: PropTypes.string,
  variant: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({})]),
};

FormTextArea.defaultProps = {
  label: '',
  rows: 3,
  onChange: () => {
  },
};

export default FormTextArea;
