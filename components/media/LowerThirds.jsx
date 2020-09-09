import React from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import useUIStore from '../hooks/useUIStore';

import Content from '../common/lower-thirds/Content';
import CloseButton from '../common/CloseButton';

const LowerThirds = observer(() => {
  const { toggleRightBlock, isTimelineOpen } = useUIStore();

  return (
    <div className={classnames('lower-thirds', { 'big-window': !isTimelineOpen })}>
      <header className="lower-thirds__header">Lower Thirds</header>
      <div className="lower-thirds__body">
        <Content />
      </div>

      <CloseButton onClick={() => toggleRightBlock(false)} />
    </div>
  );
});

export default LowerThirds;
