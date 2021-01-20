import React from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import LibraryCTA from '../common/libraryCTA/LibraryCTA';
import CloseButton from '../common/CloseButton';

import useUIStore from '../hooks/useUIStore';

const CallToAction = observer(() => {
  const { toggleRightBlock, isTimelineOpen } = useUIStore();

  const handleClose = () => toggleRightBlock(false);

  return (
    <div className={classnames('library-cta', { 'big-window': !isTimelineOpen })}>
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
