import React, { useEffect, useCallback } from 'react';
import { observer } from 'mobx-react';

import List from './common/gallery/List';
import {
  initialState as listInitialState,
  reducer as listReducer,
} from '../lib/utils/reducers/listReducer';
import { ACTION_TYPES } from '../lib/constants/reducers/listReducer';
import TemplatesPreview from './common/libraryElements/TemplatesPreview';
import Category from './common/libraryElements/Category';
import Categories from './common/Categories';

const Templates = observer(() => {
  const [list, dispatchList] = React.useReducer(listReducer, listInitialState);
  const [categoriesList, dispatchCategoriesList] = React.useReducer(listReducer, listInitialState);
  useEffect(() => {
    dispatchList({
      type: ACTION_TYPES.SET_INITIAL,
      value: { path: '/api/makes/templates', content: TemplatesPreview, perPage: 20 },
    });
  }, []);

  const selectCategory = useCallback((_id) => {
    dispatchCategoriesList({
      type: ACTION_TYPES.SET_ACTIVE_ITEM,
      value: _id || null,
    });
    dispatchList({
      type: ACTION_TYPES.SET_FILTER,
      value: _id ? { categories: _id } : {},
    });
  });

  useEffect(() => {
    dispatchCategoriesList({
      type: ACTION_TYPES.SET_INITIAL,
      // todo update path after implementing backend
      value: {
        path: '/api/make-categories',
        content: (props) => (
          <Category
            onClick={(item) => {
              selectCategory(item._id);
            }}
            {...props}
          />
        ),
        perPage: 25,
      },
    });
  }, []);
  return (
    <div className="templates">
      <Categories
        list={categoriesList}
        dispatchList={dispatchCategoriesList}
        select={selectCategory}
        className="categories"
      />
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
          contentClassName="library__items"
        />
      </div>
      <div className="library__gradient" />
    </div>
  );
});

export default Templates;
