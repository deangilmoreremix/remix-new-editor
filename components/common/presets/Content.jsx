import React from 'react';
import { Waypoint } from 'react-waypoint';

import useMediaStore from '../../hooks/useMediaStore';

import { showError } from '../../../lib/services/alertService';

const perPage = 12;

const Content = () => {
  const [items, setItems] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);

  const { getAssets } = useMediaStore();

  // const handleSelect = React.useCallback(async (item) => {
  //   try {
  //
  //   } catch (e) {
  //     await showError(e.message);
  //   }
  // }, []);

  const resetParams = () => {
    setPage(1);
    setHasMore(true);
    setItems([]);
  };

  const getItems = async (reset = false) => {
    if (reset) {
      resetParams();
    }

    if (hasMore) {
      try {
        const results = await getAssets({
          query: '',
          page,
          perPage,
        });

        setItems([...items, ...results]);
        const hasNextPage = results.length === perPage;
        setHasMore(hasNextPage);

        if (hasNextPage) {
          setPage(page + 1);
        }
      } catch (e) {
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

  return (
    <div>Window</div>
  );
};

export default Content;
