import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { observer } from 'mobx-react';

import List from '../../common/gallery/List';
import SearchInput from '../../form/SearchInput';

import { initialState as listInitialState, reducer as listReducer } from '../../../lib/utils/reducers/listReducer';

import { JSON_TRANSITION_TABS } from '../../../lib/constants/jsonTransition';
import { ACTION_TYPES } from '../../../lib/constants/reducers/listReducer';
import { makeTypes } from '../../../lib/constants/makes';
import PopcornPreview from '../../common/libraryElements/PopcornPreview';
import { entities } from '../../../lib/constants/templateGenerator';
import PropTypes from '../../../lib/PropTypes';

const PER_PAGE = 15;

const Overlays = observer(({ onSelect, activeElement }) => {
  const [overlaysList, dispatchOverlaysList] = useReducer(listReducer, listInitialState);
  const [searchedOverlays, setSearchedOverlays] = useState(overlaysList);

  const selectOverlay = useCallback((item) => {
    dispatchOverlaysList({
      type: ACTION_TYPES.TOGGLE_ACTIVE_ITEM,
      value: item || null,
    });
  }, []);

  useEffect(() => {
    if (overlaysList.init) {
      return onSelect(entities.OVERLAY, overlaysList.activeItem);
    }
  }, [overlaysList.activeItem]);

  useEffect(() => {
    dispatchOverlaysList({
      type: ACTION_TYPES.SET_INITIAL,
      value: {
        path: '/api/makes/revolution',
        content: (props) => (
          <PopcornPreview
            className="overlays__item"
            onClick={(overlay) => selectOverlay(overlay)}
            {...props}
          />
        ),
        filter: JSON_TRANSITION_TABS['16:9'].data,
        perPage: PER_PAGE,
        params: { segment: makeTypes.TRANSITIONS },
        activeItem: activeElement,
      },
    });
  }, []);

  useEffect(() => {
    if (overlaysList) {
      setSearchedOverlays(overlaysList);
    }
  }, [overlaysList]);

  const searchElement = (query) => {
    dispatchOverlaysList({
      type: ACTION_TYPES.SET_QUERY,
      value: query,
    });
  };

  return (
    <>
      <div className="search">
        <h4 className="search-title">Choose your overlay</h4>
        <div className="library__search-box search-box">
          <SearchInput onSearch={searchElement} />
        </div>
      </div>
      <List
        list={searchedOverlays}
        dispatchList={dispatchOverlaysList}
        className="generator-list overlays"
      />
    </>
  );
});

Overlays.propTypes = {
  onSelect: PropTypes.func.isRequired,
  activeElement: PropTypes.shape({}),
};

export default Overlays;
