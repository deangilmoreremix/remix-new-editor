import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { observer } from 'mobx-react';

import { generatorTabs } from '../../../lib/constants/templateGenerator';

import useMediaStore from '../../hooks/useMediaStore';
import { ASSET_TYPES } from '../../../lib/constants/media';
import { showError } from '../../../lib/services/alertService';
import VideoGallery from '../../media/VideoGallery/VideoGallery';

const perPage = 10;

const MediaModalContent = observer(({ inWindow, useVideo, setHeader }) => {
  const mediaStore = useMediaStore();
  const provider = mediaStore.providersList.USER;
  const remoteProvider = mediaStore.providersList.REMOTE;
  const assetType = ASSET_TYPES.VIDEO;
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [videos, setVideos] = useState([]);
  const [activeTab, setTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setHeader({ activeTab, setTab, tabs: generatorTabs });
  }, [activeTab]);

  const resetParams = () => {
    setPage(1);
    setHasMore(true);
    setVideos([]);
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
        if (activeTab === 1) {
          results = await mediaStore.getAssets({
            assetType,
            page,
            perPage,
            query,
            providerName: provider,
          });
        } else {
          results = await mediaStore.getAssets({
            assetType,
            page,
            perPage,
            query,
            providerName: remoteProvider,
          });
        }
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
    if (page === 1 && hasMore && !videos.length) {
      getAssets();
    }
  }, [page, hasMore, videos, getAssets]);

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
