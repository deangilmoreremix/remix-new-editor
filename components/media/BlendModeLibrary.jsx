import React from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import useUIStore from '../hooks/useUIStore';
import useMakeStore from '../hooks/useMakeStore';

import List from '../common/list/List';
import ImageElement from '../common/libraryElements/ImageElement';

const BlendModeLibrary = observer(() => {
  const { isTimelineOpen } = useUIStore();
  const { getTemplatesBlendMode } = useMakeStore();

  return (
    <div className={classnames('blendmode-library', { 'big-window': !isTimelineOpen })}>
      <header className="blendmode-header">Blend mode</header>
      <List
        get={getTemplatesBlendMode}
        className="blendmode-body"
        element={ImageElement}
      />
    </div>
  );
});

export default BlendModeLibrary;
