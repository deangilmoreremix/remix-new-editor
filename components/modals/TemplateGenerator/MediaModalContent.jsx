import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { observer } from 'mobx-react';

// import { generatorTabs } from '../../../lib/constants/templateGenerator';

import useMediaStore from '../../hooks/useMediaStore';
import { PROVIDERS } from '../../../lib/constants/library';
import { ASSET_TYPES, REMOTE_ASSET_TYPES } from '../../../lib/constants/media';
import { showError } from '../../../lib/services/alertService';
import VideoGallery from '../../media/VideoGallery/VideoGallery';

const perPage = 10;

const MediaModalContent = observer(({ inWindow, useVideo }) => {
  const mediaStore = useMediaStore();
  const provider = PROVIDERS.USER;
  const assetType = ASSET_TYPES.VIDEO;
  const [page, setPage] = useState(1);
  const [query] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [videos, setVideos] = useState([]);
  const [activeTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // useEffect(() => {
  //   if (isLoading) {
  //     return;
  //   }
  //   setHeader({ activeTab, setTab, tabs: generatorTabs });
  //   setTab(activeTab);
  // }, [isLoading, activeTab]);

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
        if (activeTab === 0) {
          results = await mediaStore.getAssets({
            assetType,
            page,
            perPage,
            query,
            providerName: provider,
          });
        } else {
          results = await mediaStore.getRemoteMedia({
            assetType: REMOTE_ASSET_TYPES.VIDEOS,
            count: videos.length,
            perPage,
            query,
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
        showError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
  }, [isLoading, activeTab, assetType, hasMore, mediaStore, page, provider, query, videos]);


  useEffect(() => {
    resetParams();
  }, [activeTab]);

  return (
    <div className="generator-body">
      {/* <input */}
      {/* className="generator-search" */}
      {/* type="text" */}
      {/* value={query} */}
      {/* onChange={e => setQuery(e.target.value)} */}
      {/* onKeyDown={() => getAssets(true)} */}
      {/* placeholder="Search through your content..." */}
      {/* /> */}
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
