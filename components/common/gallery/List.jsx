import React, { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react';


import Content from '../list/Content';

import useBaseStore from '../../hooks/useBaseStore';

import { showError } from '../../../lib/services/alertService';

import PropTypes from '../../../lib/PropTypes';
import ListPropType from '../../../lib/prop-types/ListPropType';

import { ACTION_TYPES } from '../../../lib/constants/reducers/listReducer';


const List = observer((
  {
    list,
    dispatchList,
    className,
  }) => {
  const { getList } = useBaseStore();

  const getItems = async () => {
    if ((list.hasMoreData && !list.isLoading) || (list.isLoading && list.page === 1)) {
      dispatchList({ type: ACTION_TYPES.SET_LOADING, value: true });
      try {
        const results = await getList({
          ...list,
        });
        dispatchList({ type: ACTION_TYPES.ADD_ITEMS, value: results });
      } catch (e) {
        showError(e.message);
        dispatchList({ type: ACTION_TYPES.SET_HAS_MORE, value: false });
      } finally {
        dispatchList({ type: ACTION_TYPES.SET_LOADING, value: false });
      }
    }
  };

  useEffect(() => {
    if (list.init) {
      getItems();
    }
  }, [list.init]);

  const itemElement = useMemo(() => (props) => <list.content {...props} />,
    [list.content]);

  return (
    <div className={className}>
      <Content
        items={list.items}
        element={itemElement}
        uploadNewItems={getItems}
        isLoading={list.isLoading}
        hasMore={list.hasMoreData}
        className="library__items"
      />
    </div>
  );
});

List.propTypes = {
  dispatchList: PropTypes.func.isRequired,
  className: PropTypes.string,
  list: ListPropType,
};

export default List;
