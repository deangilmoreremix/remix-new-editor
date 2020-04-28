import * as React from 'react';
import { observer } from 'mobx-react';

import SettingsHeader from '../settings/SettingsHeader';
import SettingsContainer from '../settings/SettingsContainer';

import useUIStore from '../hooks/useUIStore';
import useProjectStore from '../hooks/useProjectStore';

import { DEFAULT_TABS, CUSTOM_TABS } from '../../lib/constants/settings';

const SettingsEditor = observer(() => {
  const [activeTab, setTab] = React.useState(0);
  const { element } = useProjectStore();
  const { closeSecondaryWindow } = useUIStore();

  if (!element) {
    return null;
  }

  const { type } = element;

  let tabs = React.useMemo(
    () => CUSTOM_TABS[element.type] || DEFAULT_TABS,
    [type],
  );
  tabs = tabs.filter(tab => !tab.disabled);

  React.useEffect(() => {
    setTab(0);
  }, [type]);

  return (
    <div className="base-editor">
      <SettingsHeader tabs={tabs} setTab={setTab} activeTab={activeTab} />
      <div className="base-editor-elements">
        {tabs[activeTab] && (
          <SettingsContainer
            tab={tabs[activeTab].label}
            handleClose={() => closeSecondaryWindow()}
          />
        )}
      </div>
    </div>
  );
});

export default SettingsEditor;
