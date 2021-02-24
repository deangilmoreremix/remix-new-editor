import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { observer } from 'mobx-react';

import useMediaStore from '../../hooks/useMediaStore';
import { ASSET_TYPES } from '../../../lib/constants/media';
import { LIBRARY_KEYS } from '../../../lib/constants/library';
import { showError } from '../../../lib/services/alertService';
import VideoGallery from '../../media/VideoGallery/VideoGallery';

const perPage = 16;

const MediaModalContent = observer(({ inWindow, useVideo, setHeader }) => {
  const mediaStore = useMediaStore();
  const provider = mediaStore.providersList.USER;
  const assetType = ASSET_TYPES.VIDEO;
  const { providers, generatorTabs } = mediaStore.generatorProviders;
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setTab] = useState(
    (Object.values(providers).includes(LIBRARY_KEYS.PIXABAY)
      ? (Object.values(providers).indexOf(LIBRARY_KEYS.PIXABAY))
      : (Object.values(providers).indexOf(LIBRARY_KEYS.USER))),
  );

  useEffect(() => {
    setHeader({ activeTab, setTab, tabs: generatorTabs, closeButton: true });
  }, [activeTab]);

  const resetParams = () => {
    setVideos([]);
    setIsLoading(false);
    setHasMore(true);
    setPage(1);
  };

  const getAssets = React.useCallback(async (reset = false) => {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    if (reset) {
      resetParams();
    }

    if (hasMore) {
      try {
        let results = '';
        results = await mediaStore.getAssets({
          assetType,
          page,
          perPage,
          query,
          providerName: providers[activeTab],
        });
        const hasNextPage = results.length === perPage;
        setVideos(videos.concat(results));
        setHasMore(hasNextPage);
        if (hasNextPage) {
          setPage(page + 1);
        }
      } catch (e) {
        console.error(e);
        setHasMore(false);
        showError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
  }, [isLoading, activeTab, assetType, hasMore, mediaStore, page, provider, query, videos]);


  useEffect(() => {
    resetParams();
  }, [activeTab]);

  useEffect(() => {
    if (page === 1 && hasMore && !videos.length && !isLoading) {
      getAssets();
    }
  }, [page, hasMore, videos, isLoading]);

  return (
    <div className="generator-body">
      <input
        className="generator-search"
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={({ keyCode }) => {
          if (keyCode === 13) {
            resetParams();
          }
        }}
        placeholder="Type in the keyword and press ENTER to start search..."
      />
      <VideoGallery
        hasMore={hasMore}
        className="tg-media-items media-gallery"
        loadMore={getAssets}
        useWindow={inWindow}
        items={Array.from(videos)}
        onSelect={useVideo}
      />
    </div>
  );
});

MediaModalContent.propTypes = {
  inWindow: PropTypes.bool,
  useVideo: PropTypes.func.isRequired,
  setHeader: PropTypes.func.isRequired,
};

MediaModalContent.defaultProps = {
  inWindow: false,
};

export default MediaModalContent;
