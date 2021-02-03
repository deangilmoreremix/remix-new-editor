import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import { editorStyles } from '../../lib/constants/editorStyles';

import useUIStore from '../hooks/useUIStore';
import useTimelineStore from '../hooks/useTimelineStore';

import Content from '../common/lower-thirds/Content';
import CloseButton from '../common/CloseButton';

const LowerThirds = observer(() => {
  const { toggleRightBlock } = useUIStore();
  const { timelineHeight } = useTimelineStore();

  const libraryHeight = useMemo(() => (
    editorStyles.calculateHeight(timelineHeight)
  ), [timelineHeight]);

  return (
    <div style={{ height: libraryHeight }} className="lower-thirds">
      <div className="flex">
        <header className="lower-thirds__header">Lower Thirds</header>
        <CloseButton onClick={() => toggleRightBlock(false)} />
      </div>
      <div className="lower-thirds__body">
        <Content />
      </div>
    </div>
  );
});

export default LowerThirds;
