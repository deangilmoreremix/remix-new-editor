import * as React from 'react';

import PropTypes from '../../lib/PropTypes';
import useProjectStore from '../hooks/useProjectStore';
import { SETTINGS_COMPONENTS } from '../../lib/constants/settings';

const SettingsContainer = ({ tab, type }) => {
  const SettingsComponent = React.useMemo(
    () => SETTINGS_COMPONENTS[type],
    [type],
  );

  const {
    projectData,
    activeElement,
    updateActiveElement,
  } = useProjectStore();
  console.log('this.activeElement', activeElement);

  React.useEffect(() => {
    console.log({ projectData });
  }, [projectData]);

  const updateElement = (newOptions) => {
    console.log('updateElement', { ...newOptions });
    updateActiveElement(newOptions);
  };

  return (
    <SettingsComponent
      tab={tab}
      element={activeElement}
      update={updateElement}
    />
  );
};

SettingsContainer.propTypes = {
  tab: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
};

export default SettingsContainer;
