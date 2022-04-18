import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import useUIStore from '../hooks/useUIStore';
import useMakeStore from '../hooks/useMakeStore';
import useTimelineStore from '../hooks/useTimelineStore';

import { editorStyles } from '../../lib/constants/editorStyles';

import List from '../common/list/ListBlendMode';
import ProjectImageElement from '../common/libraryElements/ProjectImageElement';
import CloseButton from '../common/CloseButton';

const BlendModeLibrary = observer(() => {
  const { toggleRightBlock } = useUIStore();
  const { getTemplatesBlendMode, getEvolutionTemplatesBlendMode } = useMakeStore();
  const { timelineHeight } = useTimelineStore();

  const libraryHeight = useMemo(() => (
    editorStyles.calculateHeight(timelineHeight)
  ), [timelineHeight]);

  return (
    <div style={{ height: libraryHeight }} className="blendmode-library">
      <div className="flex">
        <header className="blendmode-library__header">Blend mode</header>
        <CloseButton onClick={() => toggleRightBlock(false)} />
      </div>
      <div className="blendmode-library__body">
        <List
          get={getTemplatesBlendMode}
          getEvolution={getEvolutionTemplatesBlendMode}
          element={ProjectImageElement}
          projectElement
          blendModeImage
        />
      </div>
    </div>
  );
});

export default BlendModeLibrary;
