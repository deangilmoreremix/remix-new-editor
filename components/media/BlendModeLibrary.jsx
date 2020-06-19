import React from 'react';
import classnames from 'classnames';

import useUIStore from '../hooks/useUIStore';

const BlendModeLibrary = () => {
  const { isTimelineOpen } = useUIStore();

  return (
    <div className={classnames('blendmode-library', { 'big-window': !isTimelineOpen })}>
        <header className="blendmode-header">Blend mode</header>
        <div className="blendmode-body">

        </div>
    </div>
  );
};

export default BlendModeLibrary;
