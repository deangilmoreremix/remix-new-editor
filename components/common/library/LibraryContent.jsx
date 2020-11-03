import React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import { Waypoint } from 'react-waypoint';
import classnames from 'classnames';
import { useDropzone } from 'react-dropzone';

import AudioPreview from './AudioPreview';
import PropTypes from '../../../lib/PropTypes';
import { LIBRARY_KEYS, LIBRARY_TABS, tabItems } from '../../../lib/constants/library';
import mediaConstants from '../../../lib/constants/media';
import { PREVIEW_MEDIA_MODAL } from '../../../lib/constants/modals';
import useModalStore from '../../hooks/useModalStore';

import trashIcon from '../../../public/static/svgImages/trash.svg';
import plusIcon from '../../../public/static/images/media/drop-plus.svg';
import playIcon from '../../../public/static/svgImages/common/play-no-border.svg';
import stopIcon from '../../../public/static/svgImages/common/stop-no-border.svg';
import selectIcon from '../../../public/static/images/media/icon-select.svg';
import deselectIcon from '../../../public/static/images/media/deselect-icon.svg';
import lockIcon from '../../../public/static/images/media/key-lock.svg';

const LibraryContent = observer((props) => {
  const {
    type,
    items,
    onSelect,
    onToggleSelect,
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
    needValidation,
    keyRef,
  } = props;

  const { openModal } = useModalStore();

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
        return <video src={item.preview || item.url}><track /></video>;
      }
      case LIBRARY_TABS.AUDIO:
      case LIBRARY_TABS.VOICE: {
        return (
          <AudioPreview
            item={item}
            volume={100}
            isActive={activeItem && activeItem.url === item.url}
          />
        );
      }
      default: {
        return <img src={item.preview || item.url} alt={item.title} />;
      }
    }
  };

  const renderActions = React.useCallback((item) => {
    switch (activeTab) {
      case LIBRARY_TABS.AUDIO:
      case LIBRARY_TABS.VOICE: {
        const isActive = activeItem && activeItem.url === item.url;
        return (
          <React.Fragment>
            { (activeBtn === LIBRARY_KEYS.USER || activeTab === LIBRARY_TABS.VOICE) && (
              <div className="library__item-audio-top">
                <button
                  onClick={() => onToggleSelect(item)}
                  className="library__item-audio-select"
                >
                  <SVGInline
                    className="library__item-top-icon"
                    svg={item.selected ? deselectIcon : selectIcon}
                  />
                </button>
                {
                  activeBtn === LIBRARY_KEYS.USER && !isDisabledUpload && !isDragActive && (
                    <button className="library__item-audio-delete" onClick={() => onDelete(item._id)}>
                      <SVGInline
                        className="library__item-top-icon"
                        svg={trashIcon}
                      />
                    </button>
                  )
                }
              </div>
            )}
            {isActive ? (
              <button className="library__item-play" onClick={() => onPlay(null)}>
                <SVGInline
                  className="library__item-audio-icon"
                  svg={stopIcon}
                />
              </button>
            ) : (
              <button className="library__item-play" onClick={() => onPlay(item)}>
                <SVGInline
                  className="library__item-audio-icon"
                  svg={playIcon}
                />
              </button>
            )}
          </React.Fragment>
        );
      }
      default: return (
        <React.Fragment>
          <div className="library__item-top">
            <button
              className="library__item-select"
              onClick={() => onToggleSelect(item)}
            >
              <SVGInline
                className="library__item-top-icon"
                svg={item.selected ? deselectIcon : selectIcon}
              />
            </button>
            {
              activeBtn === LIBRARY_KEYS.USER && !isDisabledUpload && !isDragActive && (
                <button className="library__item-delete" onClick={() => onDelete(item._id)}>
                  <SVGInline
                    className="library__item-top-icon"
                    svg={trashIcon}
                  />
                </button>
              )
            }
          </div>
          <button
            className="library__item-preview"
            onClick={() => openModal(
              PREVIEW_MEDIA_MODAL, { item, activeTab, onSelect, volume, mute: false },
            )}
          >
            Preview
          </button>
          <button className="library__item-use" onClick={() => onSelect(item)}>
            Use
          </button>
        </React.Fragment>
      );
    }
  }, [activeBtn, activeTab, isDisabledUpload, isDragActive, onDelete, onSelect]);

  const getTitle = (item) => {
    if (item.photographer) {
      return `Photo by ${item.photographer}`;
    }

    if (item.tags) {
      const [tag] = Array.isArray(item.tags) ? item.tags : item.tags.split(',');
      const newTag = tag || 'Video';

      return `${newTag[0].toUpperCase() + newTag.slice(1)} by ${item.user}`;
    } else {
      return item.title || `Untitled ${activeTab.toLowerCase()}`;
    }
  };

  const getTime = (time) => {
    if (!time) {
      return;
    }

    const minutes = Math.floor(time / 60);
    const seconds = time % 60;

    return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
  };

  const generateLockedFiles = () => {
    const dummyItems = [];
    const count = 15;

    for (let i = 0; i < count; i++) {
      dummyItems.push(
        <div className="library__item">
          <div className="library__item-lock-box">
            <SVGInline
              className="library__item-lock-icon"
              svg={lockIcon}
            />
            <div className="library__item-unlock-action">
              <button
                className="library__item-unlock"
                onClick={() => keyRef.current.focus()}
              >
                <SVGInline
                  className="library__item-lock-icon-button"
                  svg={lockIcon}
                />
                Unlock
              </button>
            </div>
          </div>
        </div>,
      );
    }

    return dummyItems;
  };

  return (
    <div className={classnames('library__items', `library__items--${activeTab.toLowerCase()}`)}>
      {(needValidation && !items.length) ? generateLockedFiles() : (
        <>
          {
            activeBtn === LIBRARY_KEYS.USER && activeTab !== LIBRARY_TABS.VOICE && (
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
              <div className="library__item-drop-box">
                <p className="library__item-drop-text">Drag n drop here from</p>
                <SVGInline
                  className="library__item-plus"
                  svg={plusIcon}
                  cleanup={['plus']}
                />
                <p className="library__item-drop-text">your computer, or ..</p>
              </div>
            </div>
            )
          }

          {
            items.length ? items.map(item => (
              <div
                key={item._id || item.url}
                className={classnames('library__item', { 'library__item-selected': item.selected })}
              >
                {Element(item)}
                <div className="library__item-actions">
                  {renderActions(item)}
                </div>
                <div className="library__item-info">
                  <SVGInline
                    className="library__item-icon"
                    svg={tabItems[activeTab].icon}
                    component="div"
                  />
                  <span>{item.name || getTitle(item)}</span>
                  {activeTab === LIBRARY_TABS.VIDEO ? (
                    <p className="library__item-videotime">{getTime(item.duration)}</p>
                  ) : (
                    <div />
                  )}
                </div>
              </div>
            )) : null
          }
          { hasMore && <Waypoint bottomOffset="3%" onEnter={uploadNewItems} /> }
        </>
      )}
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
  onToggleSelect: PropTypes.func.isRequired,
  activeBtn: PropTypes.string.isRequired,
  activeTab: PropTypes.string.isRequired,
  onDelete: PropTypes.func.isRequired,
  fetchItems: PropTypes.func.isRequired,
  isDisabledUpload: PropTypes.bool.isRequired,
  onDrop: PropTypes.func.isRequired,
  hasMore: PropTypes.bool.isRequired,
  type: PropTypes.string.isRequired,
  needValidation: PropTypes.bool.isRequired,
};

export default LibraryContent;
