import React, { useMemo, useState } from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import PropTypes from '../../../lib/PropTypes';
import { perPage } from '../../../lib/constants/library';

import useProjectStore from '../../hooks/useProjectStore';

import Content from './Content';
import { showError } from '../../../lib/services/alertService';

const List = observer(({ get, className, element: Element }) => {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(null);

  const { addData } = useProjectStore();

  const handleSelect = React.useCallback(async (item) => {
    try {
      await addData(item);
    } catch (e) {
      showError(e.message);
    }
  }, []);

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
      setIsLoading(true);
      try {
        const results = await get({
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
    <div className="list-body">
      <div className="list-items">
        <Content
          items={items}
          hasMore={hasMore}
          uploadNewItems={uploadNewItems}
          isLoading={isLoading}
          element={itemElement}
        />
      </div>
    </div>
  );
});

List.propTypes = {
  element: PropTypes.element.isRequired,
  className: PropTypes.string,
};

export default List;
