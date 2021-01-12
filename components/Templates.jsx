import React, { useEffect } from 'react';
import { observer } from 'mobx-react';

import List from './common/gallery/List';
import {
  initialState as listInitialState,
  reducer as listReducer,
} from '../lib/utils/reducers/listReducer';
import { ACTION_TYPES } from '../lib/constants/reducers/listReducer';
import ProjectPreview from './common/libraryElements/ProjectPreview';

const Templates = observer(() => {
  const [list, dispatchList] = React.useReducer(listReducer, listInitialState);
  useEffect(() => {
    dispatchList({
      type: ACTION_TYPES.SET_INITIAL,
      value: { path: '/api/makes/templates', content: ProjectPreview, perPage: 20 },
    });
  }, []);

  if (!list.init) {
    return null;
  }

  return (
    <div className="templates">
      {/* todo add Categories */}
      <div style={{ width: '13.75%' }} />
      <div className="list">
        {/* todo implement logic and styles */}
        <div className="list-settings">
          <div><span> All templates</span></div>
          <div><span>All Ratios</span></div>
        </div>
        <List
          list={list}
          dispatchList={dispatchList}
          className="library__body"
        />
      </div>
      <div className="library__gradient" />
    </div>
  );
});

export default Templates;
