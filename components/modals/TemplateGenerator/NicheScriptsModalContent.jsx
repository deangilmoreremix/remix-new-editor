import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import useMakeStore from '../../hooks/useMakeStore';
import { showError } from '../../../lib/services/alertService';
import NicheScriptsGrid from './NicheScriptsGrid';

// todo update it, Pagination does not work here.
const perPage = 250;

export default function NicheScriptsModalContent({ options: { onSelect }, setHeader }) {
  const makeStore = useMakeStore();
  const [scripts, setScripts] = useState([]);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setHeader({});
  }, []);

  const resetParams = () => {
    setPage(1);
    setHasMore(true);
    setScripts([]);
  };

  const getScripts = async (reset = false) => {
    if (reset) {
      resetParams();
    }

    if (hasMore) {
      try {
        const results = await makeStore.getNicheScripts({
          query,
          page,
          perPage,
        });

        setScripts(scripts.concat(results));
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

  useEffect(() => {
    if (page === 1) {
      getScripts();
    }
  }, [page, query]);

  return (
    <>
      <p className="template-generator-offer__text">Select a niche script</p>
      <input
        className="generator-search"
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={() => getScripts(true)}
        placeholder="Search through your content..."
      />
      <NicheScriptsGrid
        onSelect={(item) => onSelect(item)}
        loadMore={getScripts}
        hasMore={hasMore}
        items={scripts}
      />
    </>
  );
}

NicheScriptsModalContent.propTypes = {
  options: PropTypes.shape({ onSelect: PropTypes.func.isRequired }).isRequired,
  setHeader: PropTypes.func.isRequired,
};
