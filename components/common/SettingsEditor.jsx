import React, { useState, useMemo } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import SettingsHeader from '../settings/SettingsHeader';
import SettingsContainer from '../settings/SettingsContainer';

import useUIStore from '../hooks/useUIStore';
import useProjectStore from '../hooks/useProjectStore';

import { DEFAULT_TABS, CUSTOM_TABS } from '../../lib/constants/settings';
import CloseButton from './CloseButton';
import useUserStore from '../hooks/useUserStore';

const SettingsEditor = observer(() => {
  const [activeTab, setTab] = useState(0);

  const { element, retarget, activeElementId, releaseElement } = useProjectStore();
  const { currentUser, isfeatureEnabled } = useUserStore();
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

  tabs = tabs.filter(tab => {
    if (tab.disabled) {
      return false;
    }
    if (!tab.requiredFeature) {
      return true;
    }
    return currentUser.features && isfeatureEnabled(tab.requiredFeature);
  });

  React.useEffect(() => {
    setTab(0);
  }, [type]);

  const closeWindow = () => {
    toggleRightBlock(false);
    releaseElement();
  };

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

      <CloseButton onClick={closeWindow} />
    </div>
  );
});

export default SettingsEditor;
