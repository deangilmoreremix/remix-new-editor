import React, { useMemo, useCallback } from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';
import useProjectStore from '../hooks/useProjectStore';
import { SETTINGS_COMPONENTS } from '../../lib/constants/settings';

const SettingsContainer = observer(({ tab, handleClose }) => {
  const { element, element: { type }, activeElementId, findAndUpdate, form } = useProjectStore();
  const SettingsComponent = useMemo(
    () => SETTINGS_COMPONENTS[type],
    [type],
  );

  const updateElement = useCallback((newOptions) => {
    findAndUpdate(activeElementId, newOptions);
  }, [activeElementId, findAndUpdate]);

  const fields = useMemo(
    () => {
      const result = {};
      if (form) {
        Object.keys(form).forEach(fieldName => {
          const field = form[fieldName];
          if (
            field && (
              !field.group || (
                field.group && field.group.toLowerCase() === tab.toLowerCase()
              )
            )
          ) {
            result[fieldName] = field;
          }
        });
      }
      return result;
    },
    [tab, form]);

  return (
    <SettingsComponent
      tab={tab}
      fields={fields}
      element={element}
      update={updateElement}
      handleClose={handleClose}
    />
  );
});

SettingsContainer.propTypes = {
  tab: PropTypes.string.isRequired,
  handleClose: PropTypes.func,
};

export default SettingsContainer;
