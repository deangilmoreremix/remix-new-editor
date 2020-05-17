import React, { useState, useMemo } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import SettingsHeader from '../settings/SettingsHeader';
import SettingsContainer from '../settings/SettingsContainer';

import useUIStore from '../hooks/useUIStore';
import useProjectStore from '../hooks/useProjectStore';

import { DEFAULT_TABS, CUSTOM_TABS } from '../../lib/constants/settings';
import CloseButton from './CloseButton';

const SettingsEditor = observer(() => {
  const [activeTab, setTab] = useState(0);

  const { element, retarget, activeElementId } = useProjectStore();
  const { closeSecondaryWindow, toggleRightBlock, isTimelineOpen } = useUIStore();

  const currentElement = useMemo(() => {
    if (retarget) {
      if (retarget.id !== activeElementId) {
        return element;
      } else {
        return retarget;
      }
    }
    return element;
  }, [element, retarget, activeElementId]);

  if (!currentElement) {
    return null;
  }

  const { type } = currentElement;

  let tabs = React.useMemo(
    () => CUSTOM_TABS[type] || DEFAULT_TABS,
    [type],
  );
  tabs = tabs.filter(tab => !tab.disabled);

  React.useEffect(() => {
    setTab(0);
  }, [type]);

  return (
    <div className={classnames('base-editor', { 'big-window': !isTimelineOpen })}>
      <SettingsHeader tabs={tabs} setTab={setTab} activeTab={activeTab} />
      <div className="base-editor-elements">
        {tabs[activeTab] && (
          <SettingsContainer
            tab={tabs[activeTab].label}
            handleClose={() => closeSecondaryWindow()}
            element={currentElement}
          />
        )}
      </div>

      <CloseButton onClick={() => toggleRightBlock(false)} />
    </div>
  );
});

export default SettingsEditor;
