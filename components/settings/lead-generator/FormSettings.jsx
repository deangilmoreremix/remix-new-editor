import React from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

import { STYLES, FIELDS, INTEGRATIONS } from '../../../lib/constants/popcorn';

import StylesTab from './tabs/StylesTab';
import FieldsTab from './tabs/FieldsTab';
import IntegrationsTab from './tabs/IntegrationsTab';

const TabMap = {
  [STYLES]: StylesTab,
  [FIELDS]: FieldsTab,
  [INTEGRATIONS]: IntegrationsTab,
};

const FormSettings = observer(({ tab = STYLES, element, update, fields, handleClose }) => {
  const Tab = TabMap[tab];

  const handleChange = (value, options) => {
    let newOptions = { ...value };
    if (options) {
      newOptions = { ...newOptions, ...options };
    }
    update(newOptions);
  };

  return (
    <div className={classnames({ 'lead-form': element.type === 'form', 'retarget-form': element.type === 'retargetForm' })}>
      {element && (element.popcornOptions || element.options) && (
        <Tab
          type={element.type}
          values={element.popcornOptions ?? element.options}
          onChange={(field, options) => handleChange(field, options)}
          fields={fields}
          closeModal={handleClose}
        />
      )}
    </div>
  );
});

FormSettings.propTypes = {
  element: PropTypes.shape({
    options: PropTypes.shape({}).isRequired,
  }).isRequired,
  fields: PropTypes.shape({}).isRequired,
  tab: PropTypes.string,
  update: PropTypes.func.isRequired,
};

export default FormSettings;
