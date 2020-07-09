import React, { useCallback, useState, useMemo } from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import { JSON_TRANSITION_TABS } from '../../lib/constants/jsonTransition';

import useUIStore from '../hooks/useUIStore';
import useMakeStore from '../hooks/useMakeStore';
import useProjectStore from '../hooks/useProjectStore';

import Tabs from '../common/overlay/Tabs';
import CloseButton from '../common/CloseButton';
import { showError } from '../../lib/services/alertService';

const perPage = 12;

const JsonTransition = observer(() => {
  const [items, setItems] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const { getJsonTransitions } = useMakeStore();
  const { addData } = useProjectStore();

  const {
    toggleRightBlock,
    isTimelineOpen,
    secondaryWindowType: activeTab,
    setLibraryType: setActiveTab,
  } = useUIStore();

  const updateActiveTab = useCallback(async (tab) => {
    if (!isLoading) {
      await setActiveTab(tab);
      getItems(tab, true);
    }
  }, [isLoading, setActiveTab]);

  const resetParams = () => {
    setPage(1);
    setHasMore(true);
    setItems([]);
  };

  const getItems = async (tab, reset = false) => {
    if (reset) {
      resetParams();
    }

    let filter;
    Object.keys(JSON_TRANSITION_TABS).forEach(item => {
      if (item === tab) {
        filter = JSON_TRANSITION_TABS[item].data;
      }
    });

    if (hasMore) {
      try {
        const results = await getJsonTransitions({
          query: '',
          page,
          perPage,
          filter,
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
      getItems(activeTab);
    }
  }, [page]);

  const uploadNewItems = () => {
    if (page !== 1) {
      getItems();
    }
  };

  return (
    <div className={classnames('overlay', { 'big-window': !isTimelineOpen })}>
      <Tabs setActiveTab={updateActiveTab} activeTab={activeTab} />
      <div className="overlay__body">
        <div className="overlay-container">

        </div>
      </div>
      <CloseButton onClick={() => toggleRightBlock(false)} />
    </div>
  );
});

export default JsonTransition;
