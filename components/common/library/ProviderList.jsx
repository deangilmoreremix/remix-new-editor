import React, { useMemo } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';
import { LIBRARY_KEYS, LIBRARY_TABS } from '../../../lib/constants/library';

const ProviderList = observer((props) => {
  const {
    list,
    activeItem,
    title,
    userContentTitle,
    handleButtonClick,
    activeTab,
  } = props;

  const providerTitle = useMemo(() => {
    if (title) {
      return <p className="library__block--title">{title}</p>;
    }
    return null;
  }, [title]);

  return (
    <div className="library__block">
      {
        activeTab === LIBRARY_TABS.VIDEO ? (
          // eslint-disable-next-line react/jsx-no-target-blank
          <a href="http://download.vidcloud.io/" className="library__block--title" target="_blank">{title}</a>
        ) : (
          providerTitle
        )
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
