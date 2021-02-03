import React, { useEffect } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import { initialState as listInitialState, reducer as listReducer } from '../lib/utils/reducers/listReducer';
import { ACTION_TYPES } from '../lib/constants/reducers/listReducer';
import useUserStore from './hooks/useUserStore';

import ProjectsPreview from './common/libraryElements/ProjectsPreview';
import List from './common/gallery/List';

const Projects = observer(() => {
  const { hasPermissions } = useUserStore();

  const [list, dispatchList] = React.useReducer(listReducer, listInitialState);
  useEffect(() => {
    dispatchList({
      type: ACTION_TYPES.SET_INITIAL,
      value: { path: '/api/makes', content: ProjectsPreview, perPage: 20 },
    });
  }, []);

  return (
    <div className={classnames('projects', { 'dark-theme': hasPermissions })}>
      <div className="list">
        <List
          list={list}
          dispatchList={dispatchList}
          className="library__body"
          contentClassName="library__items"
        />
      </div>
      <div className="library__gradient" />
    </div>
  );
});

export default Projects;
