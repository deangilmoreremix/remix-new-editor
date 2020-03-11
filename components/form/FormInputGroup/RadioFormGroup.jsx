// TODO: should be removed after a new component is created instead this one
import PropTypes from 'prop-types';
import React, { Component, Fragment } from 'react';
import { FormFeedback, FormGroup, FormText, Input, Label } from 'reactstrap';

export default class RadioFormGroup extends Component {
    static propTypes = {
      handler: PropTypes.func.isRequired,
      hint: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
      inputType: PropTypes.string,
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
      step: PropTypes.number,
    };

    static defaultProps = {
      inputType: 'radio',
    };

    handleChange = (event) => {
      const { name, handler, valueHolder } = this.props;
      const { value } = event.target;
      handler({ ...valueHolder, value }, name);
    };

    renderRadio() {
      const {
        name,
        valueHolder,
        inputType,
        list,
      } = this.props;
      return (
        <Fragment>
          { list.map((listItem, idx) => {
            const { key, value } = listItem.key ? listItem : { key: listItem, value: listItem };
            return (
              <FormGroup key={idx} check>
                <Label check>
                  <Input
                    type={inputType}
                    name={name}
                    value={key}
                    onChange={this.handleChange}
                    checked={valueHolder.value === key}
                  />
                  {value}
                </Label>
              </FormGroup>
            );
        }) }
        </Fragment>
      );
    }

    render() {
      const {
        name,
        label,
        placeholder = label,
        hint = placeholder,
        valueHolder,
        handler, inputType,
        ...restProps
      } = this.props;
      return (
        <FormGroup {...restProps}>
          {label && <Label for={name}>{label}</Label>}
          {hint && <FormText color="muted">{hint}</FormText>}
          {this.renderRadio()}
          <FormFeedback>
            {valueHolder.error}
          </FormFeedback>
        </FormGroup>
      );
    }
}
