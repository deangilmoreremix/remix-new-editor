import React, { useEffect } from 'react';

import { initialState as listInitialState, reducer as listReducer } from '../lib/utils/reducers/listReducer';
import { ACTION_TYPES } from '../lib/constants/reducers/listReducer';

import ProjectsPreview from './common/libraryElements/ProjectsPreview';
import List from './common/gallery/List';

const Projects = () => {
  const [list, dispatchList] = React.useReducer(listReducer, listInitialState);
  useEffect(() => {
    dispatchList({
      type: ACTION_TYPES.SET_INITIAL,
      value: { path: '/api/makes', content: ProjectsPreview, perPage: 20 },
    });
  }, []);

  return (
    <div className="projects">
      <div className="list">
        <List
          list={list}
          dispatchList={dispatchList}
          className="library__body"
        />
      </div>
      <div className="library__gradient" />
    </div>
  );
};

export default Projects;
