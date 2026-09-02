import React, { useEffect, useMemo, useState } from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { perPage } from '../../../lib/constants/library';
import { MEDIA_TYPES, POPCORN_ELEMENT_TYPES } from '../../../lib/constants/popcorn';

import useProjectStore from '../../hooks/useProjectStore';
import useUserStore from '../../hooks/useUserStore';


import Content from './Content';
import { showError } from '../../../lib/services/alertService';

const List = observer((
  {
    get,
    getEvolution,
    className,
    element: Element,
    fetchAttributes,
    projectElement,
    type,
    searchValue,
    startSearch,
    setStartSearch,
    searchPage,
    blendModeImage,
    handleClose,
    query
  }) => {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const { addData, addElement } = useProjectStore();
  const userStore = useUserStore();

  const { blendModeEnabled, evolutionBlendModeEnabled } = userStore;
  const handleSelect = React.useCallback(async (item) => {
    try {
      if (projectElement) {
        if (blendModeImage) {
          item.kind = POPCORN_ELEMENT_TYPES.BLEND_MODE;
        }
        await addData(item);
        handleClose();
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
    getItems();
  },[query])

  useEffect(() => {
    if (setStartSearch && startSearch && searchValue) {
      setStartSearch(false);
      getItems(true);
    }

    if (setStartSearch && !startSearch && !searchValue && searchPage) {
      getItems(true);
    }
  }, [startSearch, searchValue]);

  const getItems = async (reset = false) => {
    if (reset) {
      resetParams();
    }

    if ((hasMore || reset) && ((searchPage && searchValue) || !searchPage)) {

      setIsLoading(true);
      try {
        if (blendModeEnabled === true) {
          const results = await get({
            query: query,
            page,
            perPage,
            ...fetchAttributes,
          });

          if (reset) {
            setItems((prevState) => [...prevState, ...results]);
            // setItems(results);
          } else {
            // setItems([...items, ...results]);
            setItems((prevState) => [...prevState, ...items, ...results]);
          }
        }

        if (evolutionBlendModeEnabled === true) {
          const resultEvolution = await getEvolution({
            query: query,
            page,
            perPage,
            ...fetchAttributes,
          });
          if (reset) {
            setItems((prevState) => [...prevState, ...resultEvolution]);
            // setItems(results);
          } else {
            // setItems([...items, ...results]);
            setItems((prevState) => [...prevState, ...items, ...resultEvolution]);
          }
        }


        // if (reset) {
        //   setItems(results);
        // } else {
        //   setItems([...items, ...results]);
        // }
        const hasNextPage = items.length === perPage;
        setHasMore(hasNextPage);
        if (hasNextPage) {
          setPage(value => value + 1);
        }
        setIsLoading(false);
      } catch (e) {
        setIsLoading(false);
        showError(e.message);
      }
    }
  };

  React.useEffect(() => {
    if (page === 1 && !searchPage) {
      getItems();
    }
  }, [page]);

  const uploadNewItems = () => {
    if (page !== 1) {
      getItems();
    }
  };

  const itemElement = useMemo(() => (props) => <Element handleSelect={handleSelect}  {...props} />,
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
  fetchAttributes: PropTypes.shape(),
  projectElement: PropTypes.bool,
  type: PropTypes.string,
  searchValue: PropTypes.string,
  startSearch: PropTypes.bool,
  setStartSearch: PropTypes.func,
  searchPage: PropTypes.bool,
  blendModeImage: PropTypes.bool,
};

List.defaultProps = {
  showCloseButton: true,
  projectElement: false,
  type: MEDIA_TYPES.IMAGE,
  startSearch: false,
  searchValue: null,
  searchPage: false,
  blendModeImage: false,
};

export default List;
