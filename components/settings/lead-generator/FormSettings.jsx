import React from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

import { STYLES, FIELDS, INTEGRATIONS, BASIC } from '../../../lib/constants/popcorn';

import StylesTab from './tabs/StylesTab';
import FieldsTab from './tabs/FieldsTab';
import IntegrationsTab from './tabs/IntegrationsTab';
import useProjectStore from '../../hooks/useProjectStore';
import withValidation from '../../hoc/withValidation';

const TabMap = {
  [STYLES]: StylesTab,
  [FIELDS]: FieldsTab,
  [INTEGRATIONS]: IntegrationsTab,
};

const FormSettings = observer(({ tab = BASIC, element, update, fields, handleClose }) => {
  const Tab = TabMap[tab];
  const [showedForm, setShowedForm] = React.useState(true);
  const { retarget, kindRetarget } = useProjectStore();

  const handleChange = (value, options) => {
    let newOptions = { ...value };
    if (options) {
      newOptions = { ...newOptions, ...options };
    }
    update(newOptions);
  };

  const toggleDeactivate = (activateState) => {
    if (activateState) {
      retarget.start();
    } else if (retarget && retarget.end) {
      retarget.end();
    }
    retarget.showed = activateState;
    setShowedForm(!showedForm);
  };

  return (
    <div className={classnames({ 'lead-form': element.type === 'form', 'retarget-form': element.type === 'retargetForm' })}>
      {element && (element.popcornOptions || element.options) && (
        <Tab
          kindRetarget={kindRetarget}
          type={element.type}
          showedForm={showedForm}
          values={element.popcornOptions ?? element.options}
          onChange={(field, options) => handleChange(field, options)}
          fields={fields}
          closeModal={handleClose}
          onClose={toggleDeactivate}
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
