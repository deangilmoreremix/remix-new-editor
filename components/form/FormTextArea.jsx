import React from 'react';
import TextField from '@material-ui/core/TextField';
import classnames from 'classnames';
import {
  createStyles,
  fade,
  Theme,
  withStyles,
  makeStyles,
  createMuiTheme,
} from '@material-ui/core/styles';

export default function FormTextArea({
   label,
   onChange,
   textAreaClassName,
   className,
   placeholder,
   value,
   rows,
  variant,
  }) {

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
}
