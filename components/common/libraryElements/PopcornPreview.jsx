import React, { useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import HoverComponent from 'react-hover-action-delay';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import usePopcornStore from '../../hooks/usePopcornStore';

import {
  DEFAULT_FONT_SIZE,
  DEFAULT_THUMBNAIL,
  DEFAULT_VIDEO_WIDTH,
} from '../../../lib/constants/project';
import PropTypes from '../../../lib/PropTypes';

import selectIcon from '../../../public/static/images/media/icon-select.svg';

const PopcornPreview = observer((
  {
    activeItem,
    className,
    item,
    onClick,
    actions,
  }) => {
  const [fontSize, setFontSize] = React.useState(DEFAULT_FONT_SIZE);
  const [hovered, setHovered] = React.useState(false);
  const wrapper = useRef(null);
  const { setData, play, destroy } = usePopcornStore();

  useEffect(() => {
    if (wrapper.current) {
      setFontSize(`${DEFAULT_FONT_SIZE * (wrapper.current.offsetWidth / DEFAULT_VIDEO_WIDTH)}px`);
    }
  }, []);

  const isActive = React.useMemo(() => activeItem && activeItem._id === item._id, [activeItem]);

  const needCover = React.useMemo(() => isActive && !hovered, [isActive, hovered]);

  const backgroundImage = React.useMemo(() => {
    if (hovered) {
      return null;
    }
    return `url(${item.thumbnail || DEFAULT_THUMBNAIL})`;
  }, [item.thumbnail, hovered]);

  const onSelectItem = () => {
    onClick(!isActive && item);
  };

  const onMouseEnter = () => {
    setData(item, wrapper.current);
    setHovered(true);
  };
  const onMouseLeave = () => {
    setHovered(false);
    destroy();
  };

  const onPlay = () => {
    if (hovered) {
      play();
    }
  };

  return (
    <HoverComponent
      timer={1000}
      action={onPlay}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
      className={`${className}-container`}
    >
      <div
        className={classnames(className, { active: isActive })}
        ref={wrapper}
        style={{ fontSize, backgroundImage }}
        onClick={onSelectItem}
        onKeyDown={() => {}}
        role="button"
        tabIndex={0}
      >
        { actions && actions.map((action) => (
          <SVGInline
            className={action.className}
            svg={action.icon}
            onClick={action.onClick(item)}
            key={action.name}
          />
        ))}
        { isActive && (
        <SVGInline
          className="preview__select"
          svg={selectIcon}
        />
        ) }
        <p className="preview__title">{item.title}</p>
      </div>
      { needCover && (
        <div className={`${className}-cover`} />
      ) }
    </HoverComponent>
  );
});

PopcornPreview.propTypes = {
  onClick: PropTypes.func.isRequired,
  activeItem: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }),
  className: PropTypes.string,
  actions: PropTypes.arrayOrObservableArrayOf(PropTypes.shape({
    onClick: PropTypes.func.isRequired,
    className: PropTypes.string,
    name: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
  }).isRequired),
  item: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    item: PropTypes.string,
  }).isRequired,
};

export default PopcornPreview;
