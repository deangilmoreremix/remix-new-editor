import React, { useState } from 'react';
import FormGroup from '@material-ui/core/FormGroup';
import InputLabel from '@material-ui/core/InputLabel';
import TextField from '@material-ui/core/TextField';
import classnames from 'classnames';
import MaskedFormControl from 'react-bootstrap-maskedinput';
import TextareaAutosize from '@material-ui/core/TextareaAutosize';
import vrAilogo from "../../public/static/svgImages/vrAilogo.png"

import PropTypes from '../../lib/PropTypes';

const FormTextField = React.forwardRef(
  (
    {
      id,
      type,
      mask,
      label,
      name,
      isAiSuggesstionVisible,
      onChange,
      onEnter,
      onBlur,
      disabled,
      inputClassName,
      labelClassName,
      className,
      placeholder,
      value,
      multiline,
      rowsMin,
      rowsMax,
      readOnly,
      labelHint,
      error,
      helperText,
      onEdit: defaultOnEdit,
      inputClass,
      handlSaveAiPrompt
    },
    ref
  ) => {
    const conditionalProps = {};
    console.log(isAiSuggesstionVisible, "isAiSuggesstionVisible12")
    const [isHint, setIsHint] = useState(false);
    const InputProps = {
      ...(readOnly ? { readOnly } : {}),
    };

    if (onEnter) {
      conditionalProps.onKeyPress = ({ which, target: { value: v } }) => {
        if (which === 13) {
          onEnter(v);
        }
      };
    }

    if (error) {
      conditionalProps.error = error;
    }
    if (helperText) {
      conditionalProps.helperText = helperText;
    }
    if (inputClass) {
      InputProps.className = `${inputClass} text-input`;
    }

    const onEdit = ({ target: { value: v } }) => {
      onChange(v);
    };

    const handleShowHint = () => {
      if (labelHint) {
        setIsHint((prevIsHint) => !prevIsHint);
      }
    };
    const handleTextareaInputProps = () => {
      if (isAiSuggesstionVisible) {
        return {
          endAdornment: (
            <React.Fragment>
              <img onClick={() => handlSaveAiPrompt()} style={{ height: "20px", width: "20px", cursor: "pointer" }} src={vrAilogo} alt="pic" />
            </React.Fragment>
          ),
        };
      } else {
        return {}; // Return an empty object if the condition is not met
      }
    };
    const handleInputProps = () => {
      if (isAiSuggesstionVisible) {
        return {
          endAdornment: (
            <React.Fragment>
              <img onClick={() => handlSaveAiPrompt()} style={{ height: "20px", width: "20px", cursor: "pointer" }} src={vrAilogo} alt="pic" />
            </React.Fragment>
          ),
        };
      } else {
        return InputProps
      }
    };
    return (
      <FormGroup className={classnames(className)} onBlur={onBlur}>
        {label && (
          <InputLabel
            key="label-key"
            className={classnames('form-control-label', labelClassName)}
          >
            {label}
          </InputLabel>
        )}
        {labelHint && isHint && (
          <span className="label-input-hint">{labelHint}</span>
        )}
        {type !== 'text' &&
          (mask ? (
            <MaskedFormControl
              ref={ref}
              mask={mask}
              key="masked-input-key"
              id={name}
              value={value}
              className={classnames(inputClassName)}
              placeholder={placeholder}
              onChange={defaultOnEdit || onEdit}
              type={type}
              name={name}
              disabled={disabled}
              InputProps={InputProps}
              {...conditionalProps}
            />
          ) : (
            <TextField
              inputRef={ref}
              key="input-key"
              id={id || name}
              name={name}
              className={classnames(
                inputClassName,
                { 'text-input': !inputClass },
                { 'input-disabled': disabled }
              )}
              value={value || (value === 0 && type === 'number') ? value : ''}
              placeholder={placeholder}
              onChange={defaultOnEdit || onEdit}
              type={type}
              disabled={disabled}
              {...conditionalProps}
              multiline={multiline}
              InputProps={handleInputProps()}
              onFocus={handleShowHint}
              onBlur={handleShowHint}
            />
          ))}
        {type === 'text' && (
          <TextareaAutosize
            ref={ref}
            key="input-key"
            id={id || name}
            name={name}
            className={classnames('text-input', inputClassName, {
              'text-input-disabled': readOnly,
            })}
            value={value || ''}
            placeholder={placeholder}
            onChange={defaultOnEdit || onEdit}
            disabled={disabled}
            {...conditionalProps}
            multiline={multiline}
            rowsMin={rowsMin}
            rowsMax={rowsMax}
            readOnly={readOnly}
            InputProps={handleTextareaInputProps()}

          />
        )}
      </FormGroup>
    );
  }
);

FormTextField.propTypes = {
  onChange: PropTypes.func,
  onEdit: PropTypes.func,
  mask: PropTypes.string,
  id: PropTypes.string,
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  helperText: PropTypes.string,
  label: PropTypes.string,
  labelHint: PropTypes.string,
  name: PropTypes.string,
  onEnter: PropTypes.func,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  inputClass: PropTypes.string,
  labelClassName: PropTypes.string,
  placeholder: PropTypes.string,
  type: PropTypes.oneOf(['input', 'text', 'number', 'password']),
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.shape({}),
  ]),
  multiline: PropTypes.bool,
  rowsMin: PropTypes.number,
  rowsMax: PropTypes.number,
  readOnly: PropTypes.bool,
};

FormTextField.defaultProps = {
  label: '',
  type: 'input',
  disabled: false,
  inputClassName: '',
  labelClassName: '',
  className: '',
  readOnly: false,
  onBlur: () => { },
  labelHint: '',
};

export default FormTextField;
