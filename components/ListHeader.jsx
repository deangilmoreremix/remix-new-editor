import React, { useState } from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';
import { useRouter } from 'next/router';

import useUIStore from './hooks/useUIStore';
import useUserStore from './hooks/useUserStore';
import useSearchStore from './hooks/useSearchStore';
import useModalStore from './hooks/useModalStore';

import UserBox from './common/user/UserBox';
import Menu from './common/Menu';

import { ENTER_KEY } from '../lib/constants/keyCodes';
import { CREATE_PROJECT_MODAL } from '../lib/constants/modals';

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
    url: '/projects',
    isLink: true,
  },
  templates: {
    title: 'Templates',
    value: 'templates',
    url: '/templates',
    isLink: true,
  },
};

const ListHeader = observer(({ className }) => {
  const router = useRouter();

  const [select, setSelect] = useState(router.route === pageList.myVideos.url
    ? pageList.myVideos : pageList.templates);
  const [q, setQ] = useState('');

  const { templatesMenuItems, templatesProjectItems } = useUIStore();
  const { hasPermissions } = useUserStore();
  const { openModal } = useModalStore();

  const { isVideo, isImage, setIsVideo, setIsImage, setQ: setQuery } = useSearchStore();

  const onChange = value => {
    const newKey = Object.keys(pageList).find(key => pageList[key].value === value);
    if (newKey) {
      setSelect(pageList[newKey]);
    }
  };

  const onKeyPress = (event) => {
    if (event.which === ENTER_KEY) {
      return setQuery(q);
    }
  };

  const openNewProjectDialog = () => {
    openModal(CREATE_PROJECT_MODAL, { items: templatesProjectItems });
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
            component="button"
            onClick={() => setQuery(q)}
          />
          <input
            value={q}
            onChange={event => setQ(event.target.value)}
            onKeyPress={onKeyPress}
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
              onClick={() => {
                setQ('');
                setQuery(null);
              }}
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

        <button className="templates-header__create" onClick={openNewProjectDialog}>
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
