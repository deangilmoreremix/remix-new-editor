import React from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import useUIStore from '../../hooks/useUIStore';

import { STICKERS_TABS } from '../../../lib/constants/stickers';

const Tabs = observer(() => {
  const { secondaryWindowType: activeTab, openStickers } = useUIStore();

  return (
    <div className="stickers-tabs">
      {Object.keys(STICKERS_TABS).map(item => (
        <button
          className={classnames('stickers-tab', { 'stickers-tab-active': STICKERS_TABS[item].value === activeTab })}
          onClick={() => openStickers(STICKERS_TABS[item].value)}
          key={STICKERS_TABS[item].value}
        >
          {STICKERS_TABS[item].label}
        </button>
      ))}
    </div>
  );
});

export default Tabs;
