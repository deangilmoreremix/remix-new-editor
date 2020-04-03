import * as React from 'react';

import PropTypes from '../../lib/PropTypes';
import useProjectStore from '../hooks/useProjectStore';
import { SETTINGS_COMPONENTS } from '../../lib/constants/settings';

const SettingsContainer = ({ tab, type }) => {
  const SettingsComponent = React.useMemo(
    () => SETTINGS_COMPONENTS[type],
    [type],
  );

  const store = useProjectStore();
  console.log('SettingsContainer.activeElement', store.activeElement);

  React.useEffect(() => {
    console.log({ prjData: store.projectData });
  }, [store]);

  const updateElement = React.useCallback((newOptions) => {
    console.log('updateElement', { ...newOptions });
    // Object.assign(store.activeElement.popcornOptions, newOptions);
    store.updateActiveElement(newOptions);
  }, [store]);

  return (
    <SettingsComponent
      tab={tab}
      element={store.activeElement}
      update={updateElement}
    />
  );
};

SettingsContainer.propTypes = {
  tab: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
};

export default SettingsContainer;
