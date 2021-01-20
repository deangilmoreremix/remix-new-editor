import React, { useState } from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import useUIStore from './hooks/useUIStore';
import useUserStore from './hooks/useUserStore';

import UserBox from './common/user/UserBox';
import Menu from './common/Menu';
// ToDO Update it for WL
import logo from '../public/static/svgImages/header/logo-2.svg';
import searchIcon from '../public/static/images/search.svg';
import clearIcon from '../public/static/svgImages/close.svg';
import videoIcon from '../public/static/images/toolbar/video.svg';
import imageIcon from '../public/static/images/toolbar/image-2.svg';

const pageList = {
  myVideos: {
    title: 'My Videos',
    value: 'myVideos',
  },
  templateClub: {
    title: 'Template Club',
    value: 'templateClub',
  },
};

const ListHeader = observer(({ className }) => {
  const [q, setQ] = useState('');
  const [isVideo, setIsVideo] = useState(false);
  const [isImage, setIsImage] = useState(false);
  const [select, setSelect] = useState(pageList.myVideos);

  const { templatesMenuItems } = useUIStore();
  const { hasPermissions } = useUserStore();

  const onChange = value => {
    const newKey = Object.keys(pageList).find(key => pageList[key].value === value);
    if (newKey) {
      setSelect(pageList[newKey]);
    }
  };

  return (
    <div className={classnames('templates-header', className, { 'dark-theme': hasPermissions })}>
      <div className="templates-header__left">
        <SVGInline
          className="templates-header__logo"
          classSuffix=""
          svg={logo}
          cleanup={['title']}
        />
      </div>

      <div className="templates-header__right">
        <div className="templates-header__search">
          <SVGInline
            className="templates-header__search-icon"
            classSuffix=""
            svg={searchIcon}
            cleanup={['title']}
          />
          <input
            value={q}
            onChange={event => setQ(event.target.value)}
            className="templates-header__input"
            type="text"
            placeholder="Search Templates ..."
          />
          <div className="templates-header__block">
            <SVGInline
              component="button"
              className="templates-header__search-clear"
              classSuffix=""
              svg={clearIcon}
              cleanup={['title']}
              onClick={() => setQ('')}
            />
            <label className="templates-header__checkbox-label">
              <input
                className="templates-header__checkbox"
                type="checkbox"
                checked={isVideo}
                onChange={event => setIsVideo(event.target.checked)}
              />
              <SVGInline
                className="templates-header__template-icon"
                classSuffix=""
                svg={videoIcon}
                cleanup={['title']}
              />
            </label>
            <label className="templates-header__checkbox-label">
              <input
                className="templates-header__checkbox"
                type="checkbox"
                checked={isImage}
                onChange={event => setIsImage(event.target.checked)}
              />
              <SVGInline
                className="templates-header__template-icon"
                classSuffix=""
                svg={imageIcon}
                cleanup={['title']}
              />
            </label>
          </div>
        </div>

        <button className="templates-header__create">
          <span className="templates-header__create-icon" />
          <span>Create a new Project</span>
        </button>

        <Menu
          toggleElement={select.title}
          items={Object.values(pageList)}
          useButton
          className="templates-header__select"
          onClick={onChange}
        />

        <Menu
          toggleElement={<UserBox greeting={false} />}
          items={templatesMenuItems}
          className="templates-header__user"
          lineDropIcon
          needEndIcon
        />
      </div>
    </div>
  );
});

export default ListHeader;
