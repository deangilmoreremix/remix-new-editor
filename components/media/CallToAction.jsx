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
      <p className="library-cta-title">Add Call To Action Button</p>
      <LibraryCTA className="library-cta-items" onSelect={handleClose} />
      <CloseButton onClick={handleClose} />
    </div>
  );
});

export default CallToAction;
