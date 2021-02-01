import React, { useEffect, useCallback } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import useUserStore from './hooks/useUserStore';
import useSearchStore from './hooks/useSearchStore';

import List from './common/gallery/List';
import {
  initialState as listInitialState,
  reducer as listReducer,
} from '../lib/utils/reducers/listReducer';
import { ACTION_TYPES } from '../lib/constants/reducers/listReducer';

import TemplatesPreview from './common/libraryElements/TemplatesPreview';
import Category from './common/libraryElements/Category';
import Categories from './common/Categories';
import RatioList from './common/templates/RatioList';

const MAKE_TYPES = {
  VIDEO: 'dynamic',
  IMAGE: 'static',
};

const Templates = observer(() => {
  const { hasPermissions } = useUserStore();

  const [list, dispatchList] = React.useReducer(listReducer, listInitialState);
  const [categoriesList, dispatchCategoriesList] = React.useReducer(listReducer, listInitialState);

  const { q, isVideo, isImage, reset: resetSearch } = useSearchStore();

  useEffect(() => dispatchList({
    type: ACTION_TYPES.SET_INITIAL,
    value: {
      path: '/api/makes/templates',
      content: TemplatesPreview,
      perPage: 20,
      filter: {
        archived: { $in: [null, false] },
      },
      orderBy: {
        createdAt: -1,
      },
    },
  }), []);

  useEffect(() => resetSearch(), []);

  useEffect(() => dispatchList({
    type: ACTION_TYPES.SET_QUERY,
    value: q,
  }), [q]);

  useEffect(() => {
    let editingMode;
    if (isVideo && !isImage) {
      editingMode = MAKE_TYPES.VIDEO;
    } else if (isImage && !isVideo) {
      editingMode = MAKE_TYPES.IMAGE;
    }
    dispatchList({
      type: ACTION_TYPES.UPDATE_FILTER,
      value: { key: 'editingMode', v: editingMode, isRemoving: !editingMode },
    });
  }, [isVideo, isImage]);

  const selectCategory = useCallback((item) => {
    dispatchCategoriesList({
      type: ACTION_TYPES.SET_ACTIVE_ITEM,
      value: item || null,
    });
    dispatchList({
      type: ACTION_TYPES.UPDATE_FILTER,
      value: { key: 'categories', v: item && item._id },
    });
  }, [list.filter]);


  const onChangeRatio = useCallback((value) => {
    dispatchList({
      type: ACTION_TYPES.UPDATE_FILTER,
      value: { key: 'ratio', v: value, isRemoving: !value },
    });
  }, [list.filter]);

  useEffect(() => {
    dispatchCategoriesList({
      type: ACTION_TYPES.SET_INITIAL,
      // todo update path after implementing backend
      value: {
        path: '/api/make-categories',
        content: (props) => (
          <Category
            onClick={(item) => {
              selectCategory(item);
            }}
            {...props}
          />
        ),
        perPage: 25,
      },
    });
  }, []);
  return (
    <div className={classnames('templates', { 'dark-theme': hasPermissions })}>
      <Categories
        list={categoriesList}
        dispatchList={dispatchCategoriesList}
        select={selectCategory}
        className="categories"
      />
      <div className="list">
        <div className="list-settings">
          <div className="templates-item">
            <button className="subheader" onClick={() => { selectCategory(); }}> All templates</button>
            &nbsp;
            {categoriesList.activeItem ? '>' : null}
            &nbsp;
            { categoriesList.activeItem ? (
              <span className="active-category">
                {categoriesList.activeItem.name}
              </span>
            ) : null}
          </div>
          <RatioList onChangeRatio={onChangeRatio} />
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
