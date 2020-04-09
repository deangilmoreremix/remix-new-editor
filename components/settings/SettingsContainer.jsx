import React, { useCallback, useMemo } from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';
import useProjectStore from '../hooks/useProjectStore';
import { SETTINGS_COMPONENTS } from '../../lib/constants/settings';

const SettingsContainer = observer(({ tab, type }) => {
  const SettingsComponent = React.useMemo(
    () => SETTINGS_COMPONENTS[type],
    [type],
  );

  const {
    findElement,
    activeElementId,
    findAndUpdate,
  } = useProjectStore();
  console.log('this.activeElement', activeElementId);

  const element = useMemo(() => findElement(activeElementId), [activeElementId]);

  const updateElement = useCallback((newOptions) => {
    findAndUpdate(activeElementId, newOptions);
  }, [activeElementId]);

  return (
    <SettingsComponent
      tab={tab}
      element={element}
      update={updateElement}
    />
  );
});

SettingsContainer.propTypes = {
  tab: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
};

export default SettingsContainer;
