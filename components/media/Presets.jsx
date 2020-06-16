import React from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import useUIStore from '../hooks/useUIStore';

import Content from '../common/presets/Content';
import CloseButton from '../common/CloseButton';

const Presets = observer(() => {
  const { toggleRightBlock, isTimelineOpen } = useUIStore();

  return (
    <div className={classnames('presets', { 'big-window': !isTimelineOpen })}>
      <div className="presets__body">
        <Content />
      </div>

      <CloseButton onClick={() => toggleRightBlock(false)} />
    </div>
  );
});

export default Presets;
