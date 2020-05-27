import React from 'react';
import PropTypes from 'prop-types';
import Gallery from 'react-masonry-infinite';
import { LibrarySpinner } from '../Loader';
import VideoTile from './VideoTile';
import useModalStore from '../../hooks/useModalStore';
import { VIDEO_PLAYER_MODAL } from '../../../lib/constants/modals';

const VideoGallery = (props) => {
  const { items, loadMore, hasMore, inWindow, onSelect } = props;
  const { openModal } = useModalStore();
  const sizes = inWindow
    ? [
      { columns: 2, gutter: 20 },
    ]
    : [
      { mq: '512px', columns: 2, gutter: 20 },
      { mq: '768px', columns: 4, gutter: 20 },
      { mq: '1024px', columns: 5, gutter: 15 },
      { mq: '1536px', columns: 5, gutter: 30 },
    ];

  return (
    <Gallery
      initialLoad
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
            preview={item.url}
            key={`tile${item._id || item.url}`}
            onPreview={
                () => openModal(VIDEO_PLAYER_MODAL, { url: item.url, title: item.title })
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
