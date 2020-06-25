import React from 'react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';

import trashIcon from '../../../../public/static/svgImages/common/trash.svg';
import burgerIcon from '../../../../public/static/svgImages/common/burger.svg';
import { showInfo } from '../../../../lib/services/alertService';
import useProjectStore from '../../../hooks/useProjectStore';

import { FORM_FIELDS_ELEMENT_LG } from '../../../../lib/constants/text-info';


const INPUT_NAME = 'inputValue';

const FieldsTab = ({ values, fields, onChange }) => {
  const inputs = values.elements ?? fields.elements.default;
  const { generateUid } = useProjectStore();

  const addField = () => {
    if (inputs.length < 5) {
      const newArr = inputs.slice();
      const newElement = {
        type: 'singleline',
        label: 'Untitled',
        token: 'UNTITLED',
        id: `0.${generateUid()}`,
        name: INPUT_NAME,
      };
      newArr.push(newElement);
      onChange({ elements: newArr });
    } else {
      showInfo(FORM_FIELDS_ELEMENT_LG.text, FORM_FIELDS_ELEMENT_LG.title);
    }
  };

  const handleChangeInput = (option, id) => {
    const newArr = inputs.map(element => {
      if (element.id === id) {
        // eslint-disable-next-line no-prototype-builtins
        if (option && !option.hasOwnProperty(INPUT_NAME)) {
          element.type = option.elements;
          element.label = option.elements;
          element.value = option.elements;
        } else {
          element.label = option[INPUT_NAME];
          element.token = option[INPUT_NAME].toUpperCase();
        }
      }
      return element;
    });
    onChange({ elements: newArr });
  };

  const onRemove = (id) => {
    const newArrInputs = inputs.filter(element => element.id !== id);
    if (newArrInputs.length) {
      onChange({ elements: newArrInputs });
    }
  };

  return (
    <div className="retarget-fields-tab">
      <div>
        <label className="form-control-label">Caption</label>
        <FieldBuilder
          value={values.caption ?? fields.caption.default}
          onChange={onChange}
          {...fields.caption}
        />
      </div>

      {inputs && inputs.map(item => (
        <div className="item-retarget-container lead-generator-container" key={item.id}>
          <SVGInline
            className="icon"
            classSuffix=""
            svg={burgerIcon}
            cleanup={['title']}
            alt="humburger"
          />
          <FieldBuilder
            type={item.type}
            value={item.label}
            name={item.name}
            className="item-form"
            inputClassName="item-retarget-container-input"
            onChange={(v) => handleChangeInput(v, item.id)}
          />
          <FieldBuilder
            value={item.value}
            {...fields.elements}
            onChange={(v) => handleChangeInput(v, item.id)}
          />
          <div className="flex-center retarget-remove">
            <SVGInline
              className="icon"
              classSuffix=""
              svg={trashIcon}
              cleanup={['title']}
              alt="Remove item"
              data-tip="Remove item"
            />
            <button onClick={() => onRemove(item.id)} className="icon icon-button svg-fix" type="button" />
          </div>
        </div>
      ))}
      <div className="addfield-container">
        <button className="addfield-container-button" onClick={() => addField()}>+ Add Field</button>
      </div>
      <div>
        <label className="form-control-label">Privacy Disclaimer</label>
        <FieldBuilder
          value={values.privacyDisclaimer ?? fields.privacyDisclaimer.default}
          onChange={onChange}
          {...fields.privacyDisclaimer}
          className="input-field-conatainer"
        />
      </div>
      <FieldBuilder
        value={values.privacyPolicyCaption ?? fields.privacyPolicyCaption.default}
        onChange={onChange}
        {...fields.privacyPolicyCaption}
        className="input-field-conatainer"
      />
      <FieldBuilder
        value={values.privacyPolicyLink ?? fields.privacyPolicyLink.default}
        onChange={onChange}
        {...fields.privacyPolicyLink}
        className="input-field-conatainer"
      />
      <FieldBuilder
        value={values.btnText ?? fields.btnText.default}
        onChange={onChange}
        {...fields.btnText}
        className="input-field-conatainer"
      />
    </div>
  );
};

FieldsTab.propTypes = {
  values: PropTypes.shape({
    elements: PropTypes.arrayOrObservableArray,
    caption: PropTypes.string,
    privacyDisclaimer: PropTypes.string,
    privacyPolicyCaption: PropTypes.string,
    privacyPolicyLink: PropTypes.string,
    btnText: PropTypes.string,
  }),
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape({
    elements: PropTypes.shape({
      default: PropTypes.arrayOf(PropTypes.shape({})),
    }),
    caption: PropTypes.shape({
      default: PropTypes.string,
    }),
    privacyDisclaimer: PropTypes.shape({
      default: PropTypes.string,
    }),
    privacyPolicyCaption: PropTypes.shape({
      default: PropTypes.string,
    }),
    privacyPolicyLink: PropTypes.shape({
      default: PropTypes.string,
    }),
    btnText: PropTypes.shape({
      default: PropTypes.string,
    }),
  }),
};
export default FieldsTab;
