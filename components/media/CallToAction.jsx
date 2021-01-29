import React, { useMemo } from 'react';
import { observer } from 'mobx-react';

import { editorStyles } from '../../lib/constants/editorStyles';

import useUIStore from '../hooks/useUIStore';
import useTimelineStore from '../hooks/useTimelineStore';

import LibraryCTA from '../common/libraryCTA/LibraryCTA';
import CloseButton from '../common/CloseButton';

const CallToAction = observer(() => {
  const { toggleRightBlock } = useUIStore();
  const { timelineHeight } = useTimelineStore();

  const handleClose = () => toggleRightBlock(false);

  const libraryHeight = useMemo(() => (
    editorStyles.calculateHeight(timelineHeight)
  ), [timelineHeight]);

  return (
    <div style={{ height: libraryHeight }} className="library-cta">
      <div className="flex">
        <header className="library-cta__header">Add Call To Action Button</header>
        <CloseButton onClick={handleClose} />
      </div>
      <div className="library-cta__body">
        <LibraryCTA className="library-cta-items" onSelect={handleClose} />
      </div>
    </div>
  );
});

export default CallToAction;
