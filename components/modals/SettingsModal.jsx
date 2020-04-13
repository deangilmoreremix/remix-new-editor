import * as React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';
import SettingsContainer from '../settings/SettingsContainer';
import useProjectStore from '../hooks/useProjectStore';
import { DEFAULT_SETTINGS } from '../../lib/constants/settings';

const SettingsModal = observer(({ options, setHeader, elementId }) => {
  const [activeTab, setTab] = React.useState(0);

  const { addElement, editElement, releaseElement } = useProjectStore();
  React.useEffect(() => {
    const { header, type } = options || {};
    if (header) {
      setHeader({ ...header, activeTab, setTab, onClose: () => releaseElement() });
    }
    if (elementId) {
      editElement(elementId);
    } else {
      addElement(DEFAULT_SETTINGS[type]);
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
      tabs: PropTypes.arrayOf(PropTypes.shape({
        label: PropTypes.string,
      })),
    }),
  }).isRequired,
  elementId: PropTypes.number,
  setHeader: PropTypes.func.isRequired,
};

export default SettingsModal;
