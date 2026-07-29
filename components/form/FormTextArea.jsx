import React, { useMemo, useState } from 'react';
import TextField from '@material-ui/core/TextField';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';
import { IconButton, InputAdornment } from '@material-ui/core';
import vrAilogo  from "../../public/static/svgImages/vrAilogo.png"

const FormTextArea = (props) => {
  const {
    label,
    onChange,
    inputClassName,
    className,
    textClassName,
    placeholder,
    value,
    isAiSuggesstionVisible,
    rows,
    variant,
    inputRef,
    maxTextSymbols,
    languageValidator,
    handlSaveAiPrompt
  } = props;
  console.log(isAiSuggesstionVisible,"isAiSuggesstionVisible123")

  const [symbolsCount, setSymbolsCount] = useState(0);
  const onEdit = ({ target: { value: v } }) => {
    if (languageValidator) {
      v = v.replace(languageValidator, '');
    }

    if ((maxTextSymbols && v.length <= maxTextSymbols) || !maxTextSymbols) {
      setSymbolsCount(v.length);
      onChange(v);
    } else {
      setSymbolsCount(maxTextSymbols);
      onChange(v.slice(0, maxTextSymbols));
    }
  };

  const handleTextareaInputProps = () => {
    if (isAiSuggesstionVisible) {
      return {
        endAdornment: (
          <InputAdornment position='top' style={{ padding:'18.5px 14px', position:'absolute', bottom:'5px',right:'0px'}}>
            <img onClick={() => handlSaveAiPrompt()} style={{ height: "20px", width: "20px", cursor: "pointer" }} src={vrAilogo} alt="pic" />
          </InputAdornment>
        ),
      };
    } else {
      return {}; // Return an empty object if the condition is not met
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
        multiline
        rows={rows}
        variant={variant}
        inputRef={inputRef}
        InputProps={handleTextareaInputProps()}
       
      />
    </div>
  );
};
FormTextArea.propTypes = {
  onChange: PropTypes.func,
  label: PropTypes.string,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  textClassName: PropTypes.string,
  placeholder: PropTypes.string,
  rows: PropTypes.number,
  variant: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  inputRef: PropTypes.shape({}),
  maxTextSymbols: PropTypes.number,
  languageValidator: PropTypes.string,
};
FormTextArea.defaultProps = {
  label: '',
  rows: 3,
  variant: 'outlined',
};
export default FormTextArea;
