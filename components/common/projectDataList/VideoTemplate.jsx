import React, { useRef } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react';

import SVGInline from 'react-svg-inline';
import useMultiselectTemplateStore from '../../hooks/useMultiselectTemplateStore';
import selectIcon from '../../../public/static/images/media/icon-select.svg';
import PropTypes from '../../../lib/PropTypes';

const VideoTemplate = (props) => {
  const {
    onSelect,
    item: { url, preview, title, poster },
    item,
    className,
    onPreview,
    needSelect,
    actions,
  } = props;
  const previewContainer = useRef(null);
  const templateStore = useMultiselectTemplateStore();

  const { selectedVideo } = templateStore;

  const togglePreview = (state) => {
    if (previewContainer && previewContainer.current) {
      previewContainer.current[state ? 'play' : 'pause']();
    }
  };
  const isWebm = React.useMemo(() => {
    const link = preview || url;
    return link.includes('webm');
  }, [preview, url]);

  const active = selectedVideo && selectedVideo.has(item._id);
  const extraProps = {};
  if (onSelect) {
    extraProps.onClick = () => onSelect(item);
  }

  return (
    <div
      className={classNames('video-tile', className, { active })}
      style={{ backgroundImage: `url(${poster || 'https://cdn.vidcloud.io/revolution/resources/poster.png'})` }}
      onKeyDown={() => {}}
      role="button"
      tabIndex="0"
      key={`${item._id}-video`}
      {...extraProps}
    >
      { active && needSelect && (
        <SVGInline
          className="preview__select"
          svg={selectIcon}
        />
      ) }
      { actions && actions.map((action) => (
        <SVGInline
          className={action.className}
          svg={action.icon}
          onClick={() => action.onClick(item)}
          key={action.name}
        />
      ))}
      <video
        className="video"
        ref={previewContainer}
        muted
        preload="metadata"
      >
        <source src={preview || url} type={isWebm ? 'video/webm' : 'video/mp4'} />
      </video>
      {/* eslint-disable-next-line jsx-a11y/mouse-events-have-key-events */}
      <div
        className={classNames('overlay', { active })}
        onMouseOver={() => togglePreview(true)}
        onMouseOut={() => togglePreview(false)}
      >
        <div
          className="buttons-container"
        >
          <p>{title}</p>
          { onPreview && <button className="video__item__button" onClick={onPreview}>Preview</button>}
        </div>
      </div>
    </div>
  );
};

VideoTemplate.propTypes = {
  item: PropTypes.shape({
    url: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    preview: PropTypes.string,
    poster: PropTypes.string,
    _id: PropTypes.string.isRequired,
  }).isRequired,
  onSelect: PropTypes.func,
  onPreview: PropTypes.func,
  className: PropTypes.string,
  needSelect: PropTypes.bool,
  actions: PropTypes.arrayOrObservableArrayOf(PropTypes.shape({
    onClick: PropTypes.func.isRequired,
    className: PropTypes.string,
    name: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
  }).isRequired),
};

export default observer(VideoTemplate);
