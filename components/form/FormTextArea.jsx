import React, { useMemo, useState } from 'react';
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
    maxTextSymbols,
  } = props;

  const [symbolsCount, setSymbolsCount] = useState(0);

  const onEdit = ({ target: { value: v } }) => {
    if ((maxTextSymbols && v.length <= maxTextSymbols) || !maxTextSymbols) {
      setSymbolsCount(v.length);
      onChange(v);
    } else {
      setSymbolsCount(maxTextSymbols);
      onChange(v.slice(0, maxTextSymbols));
    }
  };

  const counter = useMemo(() => (
    maxTextSymbols !== undefined ? (<p>{`${symbolsCount} / ${maxTextSymbols}`}</p>) : null
  ), [maxTextSymbols, symbolsCount]);

  return (
    <div className={classnames('container-textarea', className)}>
      <div className={classnames(textClassName, { 'container-textarea-head': label || symbolsCount !== undefined })}>
        {label && <p>{label}</p>}
        {counter}
      </div>
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
  rows: PropTypes.number,
  variant: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  inputRef: PropTypes.shape({}),
  maxTextSymbols: PropTypes.number,
};
FormTextArea.defaultProps = {
  label: '',
  rows: 3,
  variant: 'outlined',
};
export default FormTextArea;
