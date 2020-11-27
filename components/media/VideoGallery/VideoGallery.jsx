import React from 'react';
import PropTypes from 'prop-types';
import Gallery from 'react-masonry-infinite';
import { LibrarySpinner } from '../Loader';
import VideoTile from './VideoTile';
import useModalStore from '../../hooks/useModalStore';
import { PREVIEW_MEDIA_MODAL } from '../../../lib/constants/modals';

const VideoGallery = (props) => {
  const { items, loadMore, hasMore, inWindow, onSelect } = props;
  const { openModal } = useModalStore();
  const sizes = inWindow
    ? [
      { columns: 2, gutter: 5 },
    ]
    : [
      { mq: '512px', columns: 2, gutter: 5 },
      { mq: '780px', columns: 3, gutter: 5 },
      { mq: '1300px', columns: 4, gutter: 10 },
      { mq: '1650px', columns: 5, gutter: 15 },
    ];

  return (
    <Gallery
      initialLoad
      pack
      hasMore={hasMore}
      className="generator-gallery"
      loadMore={() => loadMore()}
      useWindow={false}
      loader={<LibrarySpinner key={0} />}
      sizes={sizes}
    >
      {
        items.map(item => (
          <VideoTile
            url={item.url}
            title={item.title}
            preview={item.preview || item.url}
            key={`tile-${item._id || item.url}`}
            onPreview={
              () => openModal(PREVIEW_MEDIA_MODAL, {
                item, activeTab: 'VIDEO', volume: 100, mute: false, hasUse: false,
              })
            }
            onSelect={() => { onSelect(item); }}
          />
        ))
      }
    </Gallery>
  );
};

VideoGallery.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string,
    url: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    preview: PropTypes.string,
  })),
  loadMore: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  hasMore: PropTypes.bool.isRequired,
  inWindow: PropTypes.bool,
};

VideoGallery.defaultProps = {
  inWindow: false,
};

export default VideoGallery;
