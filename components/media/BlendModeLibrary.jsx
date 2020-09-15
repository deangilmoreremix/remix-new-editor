import React from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import useUIStore from '../hooks/useUIStore';
import useMakeStore from '../hooks/useMakeStore';

import List from '../common/list/List';
import ProjectImageElement from '../common/libraryElements/ProjectImageElement';
import CloseButton from '../common/CloseButton';

const BlendModeLibrary = observer(() => {
  const { toggleRightBlock, isTimelineOpen } = useUIStore();
  const { getTemplatesBlendMode } = useMakeStore();

  return (
    <div className={classnames('blendmode-library', { 'big-window': !isTimelineOpen })}>
      <header className="blendmode-library__header">Blend mode</header>
      <div className="blendmode-library__body">
        <List
          get={getTemplatesBlendMode}
          element={ProjectImageElement}
          projectElement
          blendModeImage
        />
        <CloseButton onClick={() => toggleRightBlock(false)} />
      </div>
    </div>
  );
});

export default BlendModeLibrary;
