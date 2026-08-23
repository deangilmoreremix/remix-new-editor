import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import useUIStore from '../hooks/useUIStore';
import useMakeStore from '../hooks/useMakeStore';
import useTimelineStore from '../hooks/useTimelineStore';

import { editorStyles } from '../../lib/constants/editorStyles';

import List from '../common/list/ListBlendMode';
import ProjectImageElement from '../common/libraryElements/ProjectImageElement';
import CloseButton from '../common/CloseButton';

const BlendModeLibrary = observer(({handleClose,query}) => {
  const { toggleRightBlock } = useUIStore();
  const { getTemplatesBlendMode, getEvolutionTemplatesBlendMode } = useMakeStore();
  const { timelineHeight } = useTimelineStore();

  const libraryHeight = useMemo(() => (
    editorStyles.calculateHeight(timelineHeight)
  ), [timelineHeight]);

  return (
    <div>
      <div className="lower-third-list">
        <List
          get={getTemplatesBlendMode}
          getEvolution={getEvolutionTemplatesBlendMode}
          element={ProjectImageElement}
          projectElement
          blendModeImage
          handleClose={handleClose}
          query={query}
        />
      </div>
    </div>
  );
});

export default BlendModeLibrary;
