import React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import { Waypoint } from 'react-waypoint';
import classnames from 'classnames';
import { useDropzone } from 'react-dropzone';

import AudioPreview from './AudioPreview';
import PropTypes from '../../../lib/PropTypes';
import { LIBRARY_KEYS, LIBRARY_TABS } from '../../../lib/constants/library';
import mediaConstants from '../../../lib/constants/media';

import trashIcon from '../../../public/static/svgImages/trash.svg';
import addIcon from '../../../public/static/svgImages/add-white.svg';
import plusIcon from '../../../public/static/svgImages/plus-circle.svg';
import playIcon from '../../../public/static/svgImages/common/play-no-border.svg';
import stopIcon from '../../../public/static/svgImages/common/stop-no-border.svg';

const LibraryContent = observer((props) => {
  const {
    type,
    items,
    onSelect,
    activeBtn,
    onDelete,
    onPlay,
    fetchItems,
    isDisabledUpload,
    onDrop,
    hasMore,
    activeTab,
    volume,
    activeItem,
  } = props;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
    onDrop,
    disabled: false,
  });

  const uploadNewItems = () => {
    fetchItems({ source: activeBtn, isScrolling: true });
  };

  const Element = (item) => {
    switch (type) {
      case LIBRARY_TABS.VIDEO: {
        return <video src={item.url}><track /></video>;
      }
      case LIBRARY_TABS.AUDIO: {
        return (
          <AudioPreview
            item={item}
            volume={volume}
            isActive={activeItem && activeItem.url === item.url}
          />
        );
      }
      default: {
        return <img src={item.url} alt={item.title} />;
      }
    }
  };

  const renderActions = React.useCallback((item) => {
    switch (activeTab) {
      case LIBRARY_TABS.AUDIO: {
        const isActive = activeItem && activeItem.url === item.url;
        return (
          <React.Fragment>
            { activeBtn === LIBRARY_KEYS.USER && (
              <button className="library__item-delete" onClick={() => onDelete(item._id)}>
                <SVGInline
                  className="library__item-icon"
                  svg={trashIcon}
                />
              </button>
            )}
            {isActive ? (
              <button className="library__item-play" onClick={() => onPlay(null)}>
                <SVGInline
                  className="library__item-icon"
                  svg={stopIcon}
                />
              </button>
            ) : (
              <button className="library__item-play" onClick={() => onPlay(item)}>
                <SVGInline
                  className="library__item-icon"
                  svg={playIcon}
                />
              </button>
            )}
            <button className="library__item-use" onClick={() => onSelect({ ...item, volume, mute: false })}>
              use
            </button>
          </React.Fragment>
        );
      }
      default: return (
        <React.Fragment>
          {
            activeBtn === LIBRARY_KEYS.USER && !isDisabledUpload && !isDragActive && (
              <button className="library__item-delete" onClick={() => onDelete(item._id)}>
                <SVGInline
                  className="library__item-icon"
                  svg={trashIcon}
                />
              </button>
            )
          }
          <button className="library__item-add" onClick={() => onSelect(item)}>
            <SVGInline
              className="library__item-icon"
              svg={addIcon}
            />
          </button>
        </React.Fragment>
      );
    }
  }, [activeBtn, activeTab, isDisabledUpload, isDragActive, onDelete, onSelect]);

  return (
    <div className={classnames('library__items', `library__items--${activeTab.toLowerCase()}`)}>
      {
        activeBtn === LIBRARY_KEYS.USER && (
          <div
            {...getRootProps()}
            className={classnames(
              'library__item library__item-drop',
              {
                'library__item-drag': isDragActive,
                'library__item-disabled': isDisabledUpload,
              },
            )}
          >
            <input {...getInputProps()} disabled={isDisabledUpload} />
            <SVGInline
              className="library__item-plus"
              svg={plusIcon}
              cleanup={['plus']}
            />
          </div>
        )
      }

      {
        items.length
          ? items.map(item => (
            <div
              key={item._id || item.url}
              className="library__item"
            >
              {Element(item)}
              <div className="library__item-actions">
                {renderActions(item)}
              </div>
            </div>
          )) : null
      }
      { hasMore && <Waypoint bottomOffset="3%" onEnter={uploadNewItems} /> }
    </div>
  );
});

LibraryContent.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]),
    url: PropTypes.string.isRequired,
    title: PropTypes.string,
  })),
  onSelect: PropTypes.func.isRequired,
  activeBtn: PropTypes.string.isRequired,
  activeTab: PropTypes.string.isRequired,
  onDelete: PropTypes.func.isRequired,
  fetchItems: PropTypes.func.isRequired,
  isDisabledUpload: PropTypes.bool.isRequired,
  onDrop: PropTypes.func.isRequired,
  hasMore: PropTypes.bool.isRequired,
  type: PropTypes.string.isRequired,
};

export default LibraryContent;
