import React from 'react';
import { Waypoint } from 'react-waypoint';

import PropTypes from '../../../lib/PropTypes';

import TextToSpeechItem from './TextToSpeechItem';

const TextToSpeechContent = (props) => {
  const {
    fetchItems,
    hasMore,
    items,
    activeItem,
    onPlay,
    onSelect,
    onDelete,
    isLoading,
  } = props;

  const uploadNewItems = () => {
    fetchItems({ isScrolling: true });
  };

  return (
    <div className="text-to-speech__library-content">
      {
        items.length
          ? items.map(item => (
            <TextToSpeechItem
              key={item._id || item.url}
              data={item}
              activeItem={activeItem}
              onPlay={onPlay}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          )) : null
      }
      { hasMore && !isLoading && (
        <Waypoint bottomOffset="3%" onEnter={uploadNewItems}>
          <span className="list-waypoint" />
        </Waypoint>
      )}
    </div>
  );
};

TextToSpeechContent.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]),
    url: PropTypes.string.isRequired,
    title: PropTypes.string,
  })),
  fetchItems: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  hasMore: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool,
  activeItem: PropTypes.shape(),
  onPlay: PropTypes.func.isRequired,
};

export default TextToSpeechContent;
