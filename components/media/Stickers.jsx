import React from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import Tabs from '../common/stickers/Tabs';
import Content from '../common/stickers/Content';
import CloseButton from '../common/CloseButton';

import useUIStore from '../hooks/useUIStore';

const Stickers = observer(() => {
  const { toggleRightBlock, isTimelineOpen } = useUIStore();

  return (
    <div className={classnames('stickers', { 'big-window': !isTimelineOpen })}>
      <header className="stickers__header">Stickers</header>
      <Tabs />
      <div className="stickers__body">
        <Content />
      </div>

      <CloseButton onClick={() => toggleRightBlock(false)} />
    </div>
  );
});

export default Stickers;
