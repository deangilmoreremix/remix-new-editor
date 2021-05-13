import React, { useCallback, useEffect } from 'react';
import { observer } from 'mobx-react';
import SearchInput from '../../form/SearchInput';
import {
  initialState as listInitialState,
  reducer as listReducer,
} from '../../../lib/utils/reducers/listReducer';
import { ACTION_TYPES } from '../../../lib/constants/reducers/listReducer';
import { TEMPLATES_SEGMENTS } from '../../../lib/constants/templateSegments';
import List from '../../common/gallery/List';
import NicheScript from './NicheScript';
import PropTypes from '../../../lib/PropTypes';

import { entities } from '../../../lib/constants/templateGenerator';

const NicheScriptsModalContent = observer(({ onSelect, activeElement }) => {
  const [list, dispatchList] = React.useReducer(listReducer, listInitialState);

  const select = useCallback((item) => {
    dispatchList({
      type: ACTION_TYPES.TOGGLE_ACTIVE_ITEM,
      value: item || null,
    });
  }, []);

  useEffect(() => {
    if (list.init) {
      return onSelect(entities.NICHE_SCRIPT, list.activeItem);
    }
  }, [list.activeItem]);

  useEffect(() => dispatchList({
    type: ACTION_TYPES.SET_INITIAL,
    value: {
      path: '/api/makes/revolution',
      params: { segment: TEMPLATES_SEGMENTS.NICHE_SCRIPTS },
      // todo update preview
      content: (props) => (
        <NicheScript
          onClick={(item) => {
            select(item);
          }}
          allowedPreview
          {...props}
        />
      ),
      perPage: 18,
      filter: {
        archived: { $in: [null, false] },
      },
      activeItem: activeElement,
      orderBy: {
        createdAt: -1,
      },
    },
  }), []);

  useEffect(() => {
    if (!list.init) {
      dispatchList({
        type: ACTION_TYPES.SET_LOADING,
        value: true,
      });
    }
  }, [list.init]);

  const searchElement = (query) => {
    dispatchList({
      type: ACTION_TYPES.SET_QUERY,
      value: query,
    });
  };

  return (
    <>
      <div className="search">
        <h4 className="search-title">Choose your script</h4>
        <div className="library__search-box search-box">
          <SearchInput onSearch={searchElement} />
        </div>
      </div>
      <List
        list={list}
        dispatchList={dispatchList}
        className="generator-list niche-scripts-list"
      />
    </>
  );
});

NicheScriptsModalContent.propTypes = {
  onSelect: PropTypes.func.isRequired,
  activeElement: PropTypes.shape({}),
};

export default NicheScriptsModalContent;
