import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';

import { STYLES, FIELDS, INTEGRATIONS, BASIC } from '../../../lib/constants/popcorn';

import StylesTab from './tabs/StylesTab';
import FieldsTab from './tabs/FieldsTab';
import IntegrationsTab from './tabs/IntegrationsTab';

const TabMap = {
  [STYLES]: StylesTab,
  [FIELDS]: FieldsTab,
  [INTEGRATIONS]: IntegrationsTab,
};

const LeadGEneratorSettings = observer(({ tab = BASIC, element, update, fields, handleClose }) => {
  const Tab = TabMap[tab];

  const handleChange = (value, options) => {
    let newOptions = { ...value };
    if (options) {
      newOptions = { ...newOptions, ...options };
    }
    update(newOptions);
  };

  return (
    <div className="retarget-form">
      {element && element.popcornOptions && (
        <Tab
          values={element.popcornOptions}
          onChange={(field, options) => handleChange(field, options)}
          fields={fields}
          closeModal={handleClose}
        />
      )}
    </div>
  );
});

LeadGEneratorSettings.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    track: PropTypes.string.isRequired,
    popcornOptions: PropTypes.shape({
      url: PropTypes.string,
    }).isRequired,
  }).isRequired,
  tab: PropTypes.string,
  update: PropTypes.func.isRequired,
};

export default LeadGEneratorSettings;
