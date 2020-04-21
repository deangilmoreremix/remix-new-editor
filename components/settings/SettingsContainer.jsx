import React, { useMemo, useCallback } from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';
import useProjectStore from '../hooks/useProjectStore';
import { SETTINGS_COMPONENTS } from '../../lib/constants/settings';

const SettingsContainer = observer(({ tab, type, handleClose }) => {
  const SettingsComponent = useMemo(
    () => SETTINGS_COMPONENTS[type],
    [type],
  );

  const { findElement, activeElementId, findAndUpdate, form } = useProjectStore();
  const element = useMemo(
    () => findElement(activeElementId),
    [activeElementId],
  );

  const updateElement = useCallback((newOptions) => {
    findAndUpdate(activeElementId, newOptions);
  }, [activeElementId]);

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
  type: PropTypes.string.isRequired,
  handleClose: PropTypes.func,
};

export default SettingsContainer;
