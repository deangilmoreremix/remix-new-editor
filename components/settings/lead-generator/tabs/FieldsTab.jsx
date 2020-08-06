import React from 'react';

import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';

import { showInfo } from '../../../../lib/services/alertService';
import useProjectStore from '../../../hooks/useProjectStore';

import { FORM_FIELDS_ELEMENT_LG } from '../../../../lib/constants/text-info';
import InputFieldItem from '../InputFieldItem';
import SortableList from '../../../common/SortableList';


const INPUT_NAME = 'inputValue';

const FieldsTab = ({ values, fields, onChange, type }) => {
  const inputs = values.elements ?? fields.elements.default;
  const { generateUid, moveFormFields } = useProjectStore();

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

  const handleChangeInput = (editElem, id) => {
    const newArr = inputs.map(element => {
      if (element.id === id) {
        if (Array.isArray(editElem)) {
          const [val] = editElem;
          element.label = val || 'Untitled';
          element.token = val.toUpperCase() || 'UNTITLED';
        } else {
          element.label = editElem.elements ?? element.label;
          element.type = editElem.elements ?? element.type;
          element.value = editElem.elements ?? element.value;
          element.token = editElem?.elements?.toUpperCase() ?? element.token;
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

  const onSortEnd = ({ oldIndex, newIndex }) => {
    if (oldIndex === newIndex) {
      return;
    }
    moveFormFields(oldIndex, newIndex, type);
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
      <SortableList
        items={inputs}
        onSortEnd={onSortEnd}
        component={InputFieldItem}
        onRemove={onRemove}
        fields={fields}
        handleChangeInput={handleChangeInput}
        sortById="id"
        valueDistance={1}
      />
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
  type: PropTypes.string,
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
