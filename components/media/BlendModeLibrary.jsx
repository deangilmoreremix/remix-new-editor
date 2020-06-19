import React from 'react';
import classnames from 'classnames';

import { perPage } from '../../lib/constants/library';

import useUIStore from '../hooks/useUIStore';

const BlendModeLibrary = () => {
  const [items, setItems] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);

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
