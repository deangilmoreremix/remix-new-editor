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

  const { element, retarget, activeElementId, releaseElement } = useProjectStore();
  const { closeSecondaryWindow, toggleRightBlock, isTimelineOpen } = useUIStore();

  const currentElement = useMemo(() => {
    if (retarget) {
      if (retarget.id !== activeElementId) {
        return element;
      } else {
        retarget.additionalType = retarget.kind;
        return retarget;
      }
    }
    return element;
  }, [element, retarget, retarget?.kind, activeElementId]);

  if (!currentElement) {
    return null;
  }

  const { additionalType, type } = currentElement;

  let tabs = React.useMemo(
    () => CUSTOM_TABS[additionalType || type] || DEFAULT_TABS,
    [type, additionalType],
  );
  tabs = tabs.filter(tab => !tab.disabled);

  const closeWindow = () => {
    toggleRightBlock(false);
    releaseElement();
  };

  return (
    <div className={classnames('base-editor', { 'big-window': !isTimelineOpen })}>
      <SettingsHeader tabs={tabs} setTab={setTab} activeTab={activeTab} />
      {tabs[activeTab] ? (
        <div className="base-editor-elements">
          <SettingsContainer
            tab={tabs[activeTab].label}
            handleClose={() => closeSecondaryWindow()}
            element={currentElement}
          />
        </div>
      ) : setTab(0)}
      <CloseButton onClick={closeWindow} />
    </div>
  );
});

export default SettingsEditor;
