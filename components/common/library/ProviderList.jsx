import React, { useMemo } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';
import { LIBRARY_KEYS, LIBRARY_TABS } from '../../../lib/constants/library';
import { URL_VIDEO_MODAL } from '../../../lib/constants/modals';

import useModalStore from '../../hooks/useModalStore';
import useUserStore from '../../hooks/useUserStore';

import addUrlIcon from '../../../public/static/svgImages/addurl.svg';

const ProviderList = observer((props) => {
  const {
    list,
    activeItem,
    title,
    userContentTitle,
    handleButtonClick,
    activeTab,
  } = props;

  const { openModal } = useModalStore();
  const {
    revolutionAdvancedOptInEnabled,
    basicMediaSupportEnabled,
    video360Enabled,
    op360Enabled,
  } = useUserStore();

  const providerTitle = useMemo(() => {
    if (title) {
      return <p className="library__block--title">{title}</p>;
    }
    return null;
  }, [title]);

  const openUrlModal = () => {
    openModal(URL_VIDEO_MODAL);
  };

  const isEnabledAddUrl = useMemo(() => !!(activeTab === LIBRARY_TABS.VIDEO
      && (revolutionAdvancedOptInEnabled
        || basicMediaSupportEnabled
        || video360Enabled
        || op360Enabled)), [
    activeTab,
    revolutionAdvancedOptInEnabled,
    basicMediaSupportEnabled,
    video360Enabled,
    op360Enabled,
  ]);

  return (
    <div className="library__block-sidebar">
      {
        activeTab === LIBRARY_TABS.VIDEO ? (
          // eslint-disable-next-line react/jsx-no-target-blank
          <a href="http://download.vidcloud.io/" className="library__block--title" target="_blank">{title}</a>
        ) : providerTitle
      }
      <div className="library__btn-container">
        {
          list && Object.keys(list).map(element => (
            <button
              type="button"
              key={list[element].name}
              className={classnames(
                'library__btn-item',
                {
                  'library__btn-active': activeItem === element,
                  'library__btn-user': element === LIBRARY_KEYS.USER,
                },
              )}
              onClick={() => handleButtonClick(element)}
            >
              {list[element].icon && (
                <SVGInline
                  className="library__icon-btn"
                  svg={list[element].icon}
                  cleanup={[list[element].name]}
                />
              )}
              <p>
                {element === LIBRARY_KEYS.USER
                  ? `${list[element].name} ${userContentTitle}`
                  : list[element].name}
              </p>
            </button>
          ))
        }
        {
          isEnabledAddUrl && (
            <button
              className="library__btn-item"
              onClick={openUrlModal}
            >
              <SVGInline
                className="library__icon-btn"
                svg={addUrlIcon}
              />
              <p>Add URL...</p>
            </button>
          )
        }
      </div>
    </div>
  );
});

ProviderList.propTypes = {
  list: PropTypes.shape({}).isRequired,
  activeItem: PropTypes.string.isRequired,
  title: PropTypes.string,
  userContentTitle: PropTypes.string,
  handleButtonClick: PropTypes.func.isRequired,
  activeTab: PropTypes.string,
};

ProviderList.defaultProps = {
  userContentTitle: '',
};

export default ProviderList;
