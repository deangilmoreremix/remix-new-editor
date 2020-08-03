import React, { useEffect, useMemo, useState } from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { perPage } from '../../../lib/constants/library';
import { MEDIA_TYPES } from '../../../lib/constants/popcorn';

import useProjectStore from '../../hooks/useProjectStore';

import Content from './Content';
import { showError } from '../../../lib/services/alertService';

const List = observer((
  {
    get,
    className,
    element: Element,
    fetchAttr,
    projectElement,
    type,
    searchValue,
    startSearch,
    setStartSearch,
  }) => {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const { addData, addElement } = useProjectStore();

  const handleSelect = React.useCallback(async (item) => {
    try {
      if (projectElement) {
        await addData(item);
      } else {
        item.src = item.data;
        item.type = type;
        await addElement(item);
      }
    } catch (e) {
      showError(e.message);
    }
  }, []);

  const resetParams = () => {
    setPage(1);
    setHasMore(true);
    setItems([]);
  };

  useEffect(() => {
    if (setStartSearch && startSearch && searchValue) {
      setStartSearch(false);
      getItems(true);
    }

    if (setStartSearch && !startSearch && !searchValue) {
      getItems(true);
    }
  }, [startSearch, searchValue]);

  const getItems = async (reset = false) => {
    if (reset) {
      resetParams();
    }
    if (hasMore || startSearch) {
      setIsLoading(true);
      try {
        const results = await get({
          query: searchValue,
          page,
          perPage,
          ...fetchAttr,
        });
        if (reset) {
          setItems(results);
        } else {
          setItems([...items, ...results]);
        }
        const hasNextPage = results.length === perPage;
        setHasMore(hasNextPage);
        if (hasNextPage && !reset) {
          setPage(page + 1);
        }
        if (reset) {
          setPage(1);
        }
        setIsLoading(false);
      } catch (e) {
        setIsLoading(false);
        showError(e.message);
      }
    }
  };

  React.useEffect(() => {
    if (page === 1) {
      getItems();
    }
  }, [page]);

  const uploadNewItems = () => {
    if (page !== 1) {
      getItems();
    }
  };

  const itemElement = useMemo(() => (props) => <Element handleSelect={handleSelect} {...props} />,
    [Element]);

  return (
    <div className={classnames('list-body', className)}>
      <Content
        items={items}
        hasMore={hasMore}
        uploadNewItems={uploadNewItems}
        isLoading={isLoading}
        element={itemElement}
      />
    </div>
  );
});

List.propTypes = {
  element: PropTypes.func.isRequired,
  className: PropTypes.string,
  fetchAttr: PropTypes.shape(),
  projectElement: PropTypes.bool,
  type: PropTypes.string,
  searchValue: PropTypes.string,
  startSearch: PropTypes.bool,
  setStartSearch: PropTypes.func,
};

List.defaultProps = {
  showCloseButton: true,
  projectElement: false,
  type: MEDIA_TYPES.IMAGE,
  startSearch: false,
  searchValue: null,
};

export default List;
