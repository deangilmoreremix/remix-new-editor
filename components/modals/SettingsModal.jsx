import * as React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';
import SettingsContainer from '../settings/SettingsContainer';
import useProjectStore from '../hooks/useProjectStore';
import { DEFAULT_SETTINGS } from '../../lib/constants/settings';

const SettingsModal = observer(({ options, setHeader, elementId }) => {
  const [activeTab, setTab] = React.useState(0);

  const store = useProjectStore();
  const { addElement, editElement, releaseElement } = store;

  React.useEffect(() => {
    if (options && options.header) {
      setHeader({ ...options.header, activeTab, setTab, onClose: () => releaseElement() });
    }
    if (elementId) {
      editElement(elementId);
    } else {
      addElement(DEFAULT_SETTINGS[options.type]);
    }
  }, []);

  return (
    <SettingsContainer
      tab={options.header.tabs[activeTab].label}
      type={options.type}
      options={options}
    />
  );
});

SettingsModal.propTypes = {
  options: PropTypes.shape({
    type: PropTypes.string.isRequired,
    header: PropTypes.shape({
      tabs: PropTypes.arrayOf(PropTypes.string),
    }),
  }).isRequired,
  elementId: PropTypes.number,
  setHeader: PropTypes.func.isRequired,
};

export default SettingsModal;
