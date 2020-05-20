import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';

import { STYLES, FIELDS, INTEGRATIONS } from '../../../lib/constants/popcorn';

import StylesTab from './tabs/StylesTab';
import FieldsTab from './tabs/FieldsTab';
import IntegrationsTab from './tabs/IntegrationsTab';
import useProjectStore from '../../hooks/useProjectStore';

const TabMap = {
  [STYLES]: StylesTab,
  [FIELDS]: FieldsTab,
  [INTEGRATIONS]: IntegrationsTab,
};

const RetargetSettings = observer(({ tab = STYLES, element, update, fields }) => {
  const [showedForm, setShowedForm] = React.useState(true);
  const Tab = TabMap[tab];
  const { options } = element;
  const { retarget } = useProjectStore();

  const toggleDeactivate = (activateState) => {
    if (activateState) {
      retarget.start();
    } else {
      retarget.end();
    }
    retarget.showed = activateState;
    setShowedForm(!showedForm);
  };

  return (
    <div className="retarget-form">
      {element && (
        <Tab
          showedForm={showedForm}
          values={options}
          onChange={(field) => update(field)}
          fields={fields}
          onClose={toggleDeactivate}
        />
      )}
    </div>
  );
});

RetargetSettings.propTypes = {
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

export default RetargetSettings;
