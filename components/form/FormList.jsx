import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { action, isObservableArray, observable, computed } from 'mobx';
import { FormGroup, Label, Col, Button, Popover, Container } from 'reactstrap';
import PropTypes from '../../lib/PropTypes';
import FormTextField from './FormTextField';
// todo check ListGroupItemHeading

const DEFAULT_CONFIG = {
  text: 'title',
  value: '_id',
};

export default function FormList(props) {
  const onAddNewValue = () => {
    // todo update it
    // const { dataSourceConfig } = this.props;
    // if (this.typeaheadText) {
    //   let newValue;
    //   if (dataSourceConfig.isString) {
    //     newValue = this.typeaheadText.trim();
    //   } else {
    //     newValue = {
    //       customOption: true,
    //       id: `${new Date()}-${this.typeaheadText}`,
    //       [dataSourceConfig.text]: this.typeaheadText.trim(),
    //     };
    //   }
    //   return this.handleChange([newValue]);
    // }
  };

  const label = () => {
    const {
      title,
      hideTitle,
      required,
    } = this.props;

    if (!title) {
      return null;
    }
    return (
      <Label
        key={title}
        className="sn-control-label"
      >
        {title}
      </Label>);
  };

  const list = () => (
    <div key="multiselect-key" className="form-add-items">
      <div className="form-add-items__elements">
        <ul>
          {this.values.map((item, index) => (
            <li key={`${item._id}-item-key`}>
              {item.title}
              {' '}
              <Button onClick={() => this.handleRemove(index)}>x</Button>
            </li>
          ))}
        </ul>
      </div>
    </div>);

  const handleInputChange = (qSearch) => {
    // todo update it
    // if (this.canUpdate) {
    //   this.typeaheadText = qSearch;
    // }
    // if (!qSearch) {
    //   return this.handleSearch();
    // }
  };


  const handleRemove = (index) => {
    // todo update it
    // const { onRemove, onBlur } = this.props;
    // if (onRemove) {
    //   onRemove(index);
    // }
    // if (onBlur) {
    //   onBlur(this.getSelectedValue());
    // }
  };

  const {
    inlineLayout,
    labelCol,
    controlCol,
    allowNew,
  } = props;

  //todo update it
  let newValue = '';

  return (
    <FormGroup
      controlId="formControlsSelect"
      className={(inlineLayout ? 'form-group__horizontal' : '')}
    >
      {
          inlineLayout
            ? [
              <Col key="label-key" {...labelCol}>
                {label}
              </Col>,
              <Col key="body-key" {...controlCol}>
                {list}
              </Col>,
            ]
            : [label, list]
        }
      { allowNew && (
        <Col>
          <FormTextField
            className="authFormBlock__input inp inp-simple inp-md inp-block"
            // onChange={this.checkEmail}
            value={newValue}
          />
        </Col>
      )}
    </FormGroup>
  );
}

FormList.propTypes = {
  title: PropTypes.string,
  onRemove: PropTypes.func,
  disabled: PropTypes.bool,
  values: PropTypes.arrayOrObservableArray,
  controlCol: PropTypes.shape({
    lg: PropTypes.number,
    md: PropTypes.number,
    sm: PropTypes.number,
    xs: PropTypes.number,
  }),
  inlineLayout: PropTypes.bool,
  allowDelete: PropTypes.bool,
  allowNew: PropTypes.bool,
};

FormList.defaultProps = {
  inlineLayout: false,
  disabled: false,
  allowDelete: true,
  allowNew: true,
  values: [],
};
