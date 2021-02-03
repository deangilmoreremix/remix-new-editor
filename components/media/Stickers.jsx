import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import { editorStyles } from '../../lib/constants/editorStyles';

import useUIStore from '../hooks/useUIStore';
import useTimelineStore from '../hooks/useTimelineStore';

import Tabs from '../common/stickers/Tabs';
import Content from '../common/stickers/Content';
import CloseButton from '../common/CloseButton';

const Stickers = observer(() => {
  const { toggleRightBlock } = useUIStore();
  const { timelineHeight } = useTimelineStore();

  const libraryHeight = useMemo(() => (
    editorStyles.calculateHeight(timelineHeight)
  ), [timelineHeight]);

  return (
    <div style={{ height: libraryHeight }} className="stickers">
      <div className="flex">
        <header className="stickers__header">Stickers</header>
        <CloseButton onClick={() => toggleRightBlock(false)} />
      </div>
      <Tabs />
      <div className="stickers__body">
        <Content />
      </div>
    </div>
  );
});

export default Stickers;
