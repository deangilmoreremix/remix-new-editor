// TODO: should be removed after a new component is created instead this one
import React, { Component } from 'react';
import Select from 'react-select';
import { Label, FormFeedback, FormGroup, FormText } from 'reactstrap';
import PropTypes from 'prop-types';

class SelectFormGroup extends Component {
    options = {
      selectedOption: '',
    };

    handleChange = (selectedOption) => {
      const { name, handler, valueHolder } = this.props;
      const { value } = selectedOption;
      handler({ ...valueHolder, value }, name);
      this.options.selectedOption = selectedOption;
    };

    render() {
      const { selectedOption } = this.options;
      const value = selectedOption && selectedOption.value;
      const {
        name,
        valueHolder,
        inputType,
        list,
        label,
        handler,
        hint,
        placeholder,
        ...restProps
      } = this.props;
      const listInput = list.map(Item => ({
        labelKey: Item.key,
        value: Item.key,
        label: Item.value,
      })).filter(Item => Item.value !== ' ');
      // noinspection JSAnnotator
      return (
        <FormGroup {...restProps}>
          {label && <Label for={name}>{label}</Label>}
          {hint && <FormText color="muted">{hint}</FormText>}
          <Select
            errorText={valueHolder.error}
            type={inputType}
            name={name}
            noResultsText="This is not found..."
            placeholder={placeholder || label}
            value={value}
            resetValue={this.handleChange}
            onChange={this.handleChange}
            options={listInput}
            className={valueHolder.error && 'is-invalid'}
          />
          <FormFeedback>
            {valueHolder.error}
          </FormFeedback>
        </FormGroup>
      );
    }
}

SelectFormGroup.propTypes = {
  handler: PropTypes.func.isRequired,
  inputType: PropTypes.string,
  hint: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  label: PropTypes.oneOfType([PropTypes.string.isRequired, PropTypes.bool.isRequired]),
  list: PropTypes.arrayOf(PropTypes.oneOfType([
    PropTypes.string.isRequired,
    PropTypes.shape({
      key: PropTypes.oneOfType([
        PropTypes.number.isRequired,
        PropTypes.string.isRequired,
      ]),
      value: PropTypes.string.isRequired,
    }).isRequired,
  ])),
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  valueHolder: PropTypes.shape({
    error: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    type: PropTypes.any,
    value: PropTypes.any,
  }).isRequired,
};

SelectFormGroup.defaultProps = {
  inputType: 'select',
};

export default SelectFormGroup;
