import { Component } from '../base/Component.js';
import classnames from 'classnames';
import * as VALIDATORS from '../../lib/validators';

class FormTextField extends Component {
  constructor(props = {}) {
    super(props);
    this.props = {
      id: props.id,
      type: props.type || 'text',
      mask: props.mask,
      label: props.label,
      name: props.name,
      onChange: props.onChange,
      onEnter: props.onEnter,
      onBlur: props.onBlur,
      disabled: props.disabled,
      inputClassName: props.inputClassName,
      labelClassName: props.labelClassName,
      className: props.className,
      placeholder: props.placeholder,
      value: props.value,
      multiline: props.multiline,
      rowsMin: props.rowsMin,
      rowsMax: props.rowsMax,
      readOnly: props.readOnly,
      labelHint: props.labelHint,
      error: props.error,
      helperText: props.helperText,
      onEdit: props.onEdit,
      inputClass: props.inputClass,
      validationProps: props.validationProps,
      onValidationChange: props.onValidationChange,
    };
    this.state = {
      isHint: false,
      internalError: null,
      internalHelperText: null,
      touched: false
    };
    this.inputElement = null;
  }

  validateValue(val) {
    if (!this.props.validationProps) return null;

    const {
      type: validationType,
      isRequired = false,
      message,
    } = this.props.validationProps;

    if (isRequired && !val && val !== 0) {
      return VALIDATORS.required({ message: message || 'This field is required' })(val);
    }

    if (validationType && val) {
      const validator = VALIDATORS.default[validationType];
      if (validator) {
        return validator({ value: val, message });
      }
    }

    return null;
  }

  updateValidation() {
    if (this.props.validationProps && this.state.touched) {
      const validationError = this.validateValue(this.props.value);
      this.setState({
        internalError: validationError,
        internalHelperText: validationError || this.props.helperText
      });

      if (this.props.onValidationChange) {
        this.props.onValidationChange(this.props.name, !validationError);
      }
    }
  }

  update(newProps = {}) {
    super.update(newProps);
    this.props = { ...this.props, ...newProps };
    this.updateValidation();
  }

  onEdit = (e) => {
    const v = e.target.value;
    if (this.props.onChange) {
      this.props.onChange(v);
    }
  };

  handleShowHint = () => {
    if (this.props.labelHint) {
      this.setState({ isHint: !this.state.isHint });
    }
  };

  handleBlur = (e) => {
    this.setState({ touched: true });
    this.updateValidation();
    if (this.props.onBlur) {
      this.props.onBlur(e);
    }
  };

  handleFocus = () => {
    this.handleShowHint();
  };

  handleKeyPress = (e) => {
    if (this.props.onEnter && e.key === 'Enter') {
      this.props.onEnter(e.target.value);
    }
  };

  render() {
    const currentError = this.props.error || this.state.internalError;
    const currentHelperText = this.props.helperText || this.state.internalHelperText;

    const container = document.createElement('div');
    container.className = classnames(this.props.className, {
      'form-field-error': currentError,
      'form-field-success': !currentError && this.state.touched && this.props.value,
      'form-field-touched': this.state.touched,
    });

    // Label
    if (this.props.label) {
      const label = document.createElement('label');
      label.id = `${this.props.name}-label`;
      label.className = classnames('form-control-label', this.props.labelClassName);
      label.htmlFor = this.props.id || this.props.name;
      label.textContent = this.props.label;
      if (this.props.validationProps?.isRequired) {
        const span = document.createElement('span');
        span.className = 'required-indicator';
        span.setAttribute('aria-label', 'required');
        span.textContent = '*';
        label.appendChild(span);
      }
      container.appendChild(label);
    }

    // Hint
    if (this.props.labelHint && this.state.isHint) {
      const hint = document.createElement('span');
      hint.className = 'label-input-hint';
      hint.textContent = this.props.labelHint;
      container.appendChild(hint);
    }

    // Input
    const input = this.props.multiline ? document.createElement('textarea') : document.createElement('input');
    input.id = this.props.id || this.props.name;
    input.name = this.props.name;
    input.type = this.props.type;
    input.value = this.props.value || (this.props.value === 0 && this.props.type === 'number') ? this.props.value : '';
    input.placeholder = this.props.placeholder;
    input.disabled = this.props.disabled;
    input.readOnly = this.props.readOnly;
    input.className = classnames(this.props.inputClassName, {
      'text-input': !this.props.inputClass,
      'input-disabled': this.props.disabled,
      'input-error': currentError,
      'input-success': !currentError && this.state.touched && this.props.value,
    });
    if (this.props.multiline) {
      if (this.props.rowsMin) input.rows = this.props.rowsMin;
      if (this.props.rowsMax) input.maxLength = this.props.rowsMax; // Note: maxLength for textarea
    }
    this.addEventListener(input, 'input', this.onEdit);
    this.addEventListener(input, 'blur', this.handleBlur);
    this.addEventListener(input, 'focus', this.handleFocus);
    this.addEventListener(input, 'keypress', this.handleKeyPress);

    // Accessibility
    input.setAttribute('aria-labelledby', `${this.props.name}-label`);
    if (currentError) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', `${this.props.name}-error`);
    }
    if (currentHelperText) {
      input.setAttribute('aria-describedby', `${this.props.name}-helper`);
    }

    container.appendChild(input);

    // Helper text
    if (currentHelperText) {
      const helper = document.createElement('div');
      helper.id = `${this.props.name}-helper`;
      helper.className = 'helper-text';
      helper.textContent = currentHelperText;
      container.appendChild(helper);
    }

    // Error text
    if (currentError) {
      const error = document.createElement('div');
      error.id = `${this.props.name}-error`;
      error.className = 'error-text';
      error.textContent = currentError;
      container.appendChild(error);
    }

    return container;
  }
}

export default FormTextField;
export default FormTextField;
